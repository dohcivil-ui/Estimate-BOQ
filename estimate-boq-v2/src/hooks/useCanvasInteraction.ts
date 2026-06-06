/**
 * Canvas mouse interaction dispatcher — รวม snap/ortho/tool dispatch
 *
 * Returns:
 *   - mouse handlers สำหรับ Konva Stage
 *   - snap candidate ปัจจุบัน (สำหรับ HUD)
 *   - dialog state สำหรับ ScaleDialog
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import { screenToPage } from '@/core/coords';
import { applyOrthoLock, applyHVLock } from '@/core/orthoLock';
import { findSnap, type SnapPoint } from '@/core/snap';
import { findDarkPixelNear } from '@/core/imageEdges';
import { distancePointToSegment } from '@/core/geometry';
import { useToolStore } from '@/stores/toolStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useOrthoStore } from '@/stores/orthoStore';
import { useSnapStore, getImageThreshold } from '@/stores/snapStore';
import { useScaleStore } from '@/stores/scaleStore';
import { useCursorStore } from '@/stores/cursorStore';
import { useImageDataStore, extractRasterData } from '@/stores/imageDataStore';
import { useMeasurementStore } from '@/stores/measurementStore';
import {
  useDetectionStore,
  categoryForMark,
  findMemberAt,
} from '@/stores/detectionStore';
import { useSnapCandidates } from './useSnapCandidates';
import {
  commitDraft,
  findMeasurementAt,
} from '@/services/measurementOps';
import type { DrawingPage } from '@/types/drawing';
import type { Point2D } from '@/types/viewport';

export interface CanvasInteractionResult {
  handleMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleMouseUp: () => void;
  handleMouseLeave: () => void;
  handleWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void;
  handleDoubleClick: () => void;
  /** snap candidate ปัจจุบัน (page-px) — สำหรับ render HUD */
  currentSnap: SnapPoint | null;
  /** dialog state — สำหรับ scale tool */
  scaleDialog: { p1: Point2D; p2: Point2D } | null;
  closeScaleDialog: () => void;
  /** commit draft จาก keyboard Enter */
  commitDraftAction: () => void;
  /** cancel draft จาก keyboard Esc */
  cancelDraftAction: () => void;
}

/** ความไวซูม — ยิ่งมากยิ่งไว (zoom ตามความเร็วล้อแบบลื่น) */
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
/** จำกัด factor ต่อ event กันกระโดดบน trackpad ที่ส่ง deltaY ใหญ่ */
const WHEEL_ZOOM_MIN = 0.8;
const WHEEL_ZOOM_MAX = 1.25;

export function useCanvasInteraction(
  page: DrawingPage | null,
  stageRef: React.RefObject<Konva.Stage | null>,
): CanvasInteractionResult {
  const transformZoom = useViewportStore((s) =>
    page ? (s.byPageId[page.id]?.zoom ?? 1) : 1,
  );
  const snapEnabled = useSnapStore((s) => s.enabled);
  const snapToggles = useSnapStore((s) => s.toggles);
  const snapScreenRadius = useSnapStore((s) => s.screenRadius);
  const gridSpacingM = useSnapStore((s) => s.gridSpacingM);
  const imageSnap = useSnapStore((s) => s.imageSnap);
  const imageSensitivity = useSnapStore((s) => s.imageSensitivity);
  const scaleUnitPerPixel = useScaleStore((s) =>
    page ? (s.byPageId[page.id]?.unitPerPixel ?? null) : null,
  );

  const { segments, nodes } = useSnapCandidates(page?.id ?? null);

  const orthoActive = useOrthoStore((s) => s.enabled || s.shiftDown);
  const activeTool = useToolStore((s) => s.activeTool);
  const draftPoints = useToolStore((s) => s.draftPoints);
  // จุดเริ่มเส้น grid (reactive) — ใช้เป็น anchor ของ H/V lock ใน processCursor (preview ต้องอัปเดตตามจุดเริ่ม)
  const gridPendingStart = useToolStore((s) => s.gridPendingStart);

  const dragState = useRef<{ x: number; y: number } | null>(null);
  /** จุดเริ่มลากกล่อง paint (page-px) — null = ไม่ได้กำลังระบาย */
  const paintDrag = useRef<Point2D | null>(null);
  /** ลากย้าย member ที่เลือก — เก็บ id + offset(จุดจับ→มุมกล่อง) + firstMove(สำหรับ history) */
  const moveDrag = useRef<{
    id: string;
    dx: number;
    dy: number;
    firstMove: boolean;
  } | null>(null);
  const [currentSnap, setCurrentSnap] = useState<SnapPoint | null>(null);
  const [scaleDialog, setScaleDialog] = useState<{
    p1: Point2D;
    p2: Point2D;
  } | null>(null);

  /** lazy extract ImageData on first use */
  const ensureImageData = useCallback(
    (p: DrawingPage) => {
      const store = useImageDataStore.getState();
      if (store.byPageId[p.id]) return store.byPageId[p.id]!;
      if (!p.bitmap) return null;
      try {
        const raster = extractRasterData(p.bitmap);
        store.set(p.id, raster);
        return raster;
      } catch (err) {
        console.warn('[snap] cannot extract imageData:', err);
        return null;
      }
    },
    [],
  );

  /** ทำ snap + ortho ให้กับ raw cursor pos → คืนจุดสุดท้ายที่ใช้ */
  const processCursor = useCallback(
    (raw: Point2D): { final: Point2D; snap: SnapPoint | null } => {
      if (!page) return { final: raw, snap: null };

      const radiusPage = snapScreenRadius / transformZoom;
      let snap: SnapPoint | null = null;

      // ระยะ grid (page-px): ถ้าตั้งสเกลแล้วใช้เมตรจริง, ถ้ายัง fallback 50px
      const gridSpacing = snapToggles.grid
        ? scaleUnitPerPixel
          ? gridSpacingM / scaleUnitPerPixel
          : 50
        : undefined;

      if (snapEnabled) {
        snap = findSnap({
          cursor: raw,
          radius: radiusPage,
          segments,
          nodes,
          lastDraftPoint:
            draftPoints.length > 0
              ? draftPoints[draftPoints.length - 1]
              : null,
          toggles: snapToggles,
          gridSpacing,
        });

        // ลอง image snap ถ้าเปิดและไม่เจอ vertex snap (ให้ priority ต่ำกว่า)
        if (!snap && imageSnap) {
          const raster = ensureImageData(page);
          if (raster) {
            const dark = findDarkPixelNear(
              raster,
              raw,
              Math.round(radiusPage),
              getImageThreshold(imageSensitivity),
            );
            if (dark) {
              snap = { x: dark.x, y: dark.y, type: 'image' };
            }
          }
        }
      }

      let final: Point2D = snap
        ? { x: snap.x, y: snap.y }
        : { x: raw.x, y: raw.y };

      // ortho — ใช้กับ tool ที่กำลังวาด polyline (length/area/scale) เท่านั้น
      if (
        !snap &&
        orthoActive &&
        draftPoints.length > 0 &&
        (activeTool === 'length' ||
          activeTool === 'area' ||
          activeTool === 'scale')
      ) {
        final = applyOrthoLock(draftPoints[draftPoints.length - 1]!, raw);
      }

      // ── grid: ล็อกฉาก H/V เทียบ gridPendingStart ──
      // คนละ anchor กับ length/area/scale (พวกนั้นใช้ draftPoints) จึงเป็น branch แยก
      // เงื่อนไข: ไม่มี snap (snap ชนะ ortho) · ortho เปิด · เครื่องมือ grid · มีจุดเริ่มค้าง
      if (!snap && orthoActive && activeTool === 'grid' && gridPendingStart) {
        final = applyHVLock(gridPendingStart, final); // project ปลายไป H หรือ V ล้วน
      }

      return { final, snap };
    },
    [
      page,
      snapEnabled,
      snapScreenRadius,
      gridSpacingM,
      scaleUnitPerPixel,
      transformZoom,
      segments,
      nodes,
      draftPoints,
      snapToggles,
      imageSnap,
      imageSensitivity,
      ensureImageData,
      orthoActive,
      activeTool,
      gridPendingStart,
    ],
  );

  /** แปลง stage pointer → page-px */
  const pointerToPage = useCallback((): Point2D | null => {
    if (!page) return null;
    const stage = stageRef.current;
    if (!stage) return null;
    const ptr = stage.getPointerPosition();
    if (!ptr) return null;
    const t = useViewportStore.getState().byPageId[page.id];
    if (!t) return null;
    return screenToPage(ptr, t);
  }, [page, stageRef]);

  // ─── HANDLERS ────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!page) return;
      const isMiddle = e.evt.button === 1;
      const isLeft = e.evt.button === 0;
      const isRight = e.evt.button === 2;

      const raw = pointerToPage();
      if (!raw) return;

      // pan tool หรือ middle-click หรือ select-with-empty-area = pan
      if (activeTool === 'pan' || isMiddle) {
        dragState.current = { x: e.evt.clientX, y: e.evt.clientY };
        if (stageRef.current) {
          stageRef.current.container().style.cursor = 'grabbing';
        }
        return;
      }

      // ─── copy-stamp — มีต้นแบบ + คลิกซ้าย = วางสำเนาที่จุด (snap ถ้าเปิด) ──
      //   คลิกรัว ๆ ได้หลายจุด · สำเนา confirmed สืบ ชื่อ/สี/ขนาด จากต้นแบบ
      const stampState = useDetectionStore.getState();
      if (stampState.stamp && isLeft) {
        const { final } = processCursor(raw);
        const t = stampState.stamp;
        stampState.addMember({
          pageId: page.id,
          mark: t.mark,
          category: t.category,
          geometry: { x: final.x - t.w / 2, y: final.y - t.h / 2, w: t.w, h: t.h },
          color: t.color,
          source: 'manual',
          status: 'confirmed',
        });
        return;
      }

      // select tool — left click = hit test
      if (activeTool === 'select' && isLeft) {
        // ทุกคลิกเลือกใหม่ = ล้างเส้น grid + dimension ที่เลือกไว้ก่อน (ตั้งใหม่ถ้าโดน)
        useToolStore.getState().setSelectedGridLine(null);
        useToolStore.getState().setSelectedDimLine(null);
        // priority: member ที่ระบายไว้ก่อน → toggleSelect (เผื่อ hit pad ~10 screen px)
        const det = useDetectionStore.getState();
        const hitPad = 10 / transformZoom;
        const memberHit = findMemberAt(det.getForPage(page.id), raw, hitPad);
        if (memberHit) {
          // ตัวที่ "เลือกอยู่แล้ว" + คลิกค้าง = เริ่มลากย้าย · ตัวอื่น = เลือก
          if (det.selectedIds.includes(memberHit.id) && memberHit.geometry) {
            moveDrag.current = {
              id: memberHit.id,
              dx: raw.x - memberHit.geometry.x,
              dy: raw.y - memberHit.geometry.y,
              firstMove: true,
            };
          } else {
            det.toggleSelect(memberHit.id);
          }
          return;
        }
        // ─── grid line hit-test (inc2.5) — เลือกเส้น grid เพื่อลบด้วย Delete ──
        const gridLines = useToolStore.getState().gridLines;
        const gridTol = 8 / transformZoom; // ~8 screen px
        let gridHit = -1;
        for (let i = 0; i < gridLines.length; i++) {
          if (distancePointToSegment(raw, gridLines[i]!.a, gridLines[i]!.b) <= gridTol) {
            gridHit = i;
            break;
          }
        }
        if (gridHit >= 0) {
          det.clearSelection();
          useMeasurementStore.getState().select(null);
          useToolStore.getState().setSelectedGridLine(gridHit);
          return;
        }
        // ─── dimension line hit-test (R1-C8b) — เลือกเส้นเพื่อลบด้วย Delete ──
        const dimensions = useToolStore.getState().dimensions;
        const dimTol = 8 / transformZoom; // ~8 screen px
        let dimHit = -1;
        for (let i = 0; i < dimensions.length; i++) {
          if (distancePointToSegment(raw, dimensions[i]!.a, dimensions[i]!.b) <= dimTol) {
            dimHit = i;
            break;
          }
        }
        if (dimHit >= 0) {
          det.clearSelection();
          useMeasurementStore.getState().select(null);
          useToolStore.getState().setSelectedDimLine(dimHit);
          return;
        }
        // ไม่โดน member → ล้าง selection + บอกวิธีปักหมุดใหม่ แล้ว fallback measurement
        det.clearSelection();
        det.setPaintError('กด "ติดป้าย" เพื่อปักหมุดใหม่');
        const measurements = useMeasurementStore
          .getState()
          .getForPage(page.id);
        // radius/tolerance ใน page-px (แปลงจาก 10 screen px)
        const radius = 10 / transformZoom;
        const tol = 6 / transformZoom;
        const hit = findMeasurementAt(measurements, raw, radius, tol);
        if (hit) {
          useMeasurementStore.getState().select(hit.measurement.id);
        } else {
          useMeasurementStore.getState().select(null);
          // ถ้าคลิกพื้นที่ว่างใน select tool → ทำ pan ได้
          dragState.current = { x: e.evt.clientX, y: e.evt.clientY };
          if (stageRef.current) {
            stageRef.current.container().style.cursor = 'grabbing';
          }
        }
        return;
      }

      // ─── paint tool — เริ่มลากกล่อง (page-px) ────────────────────────
      if (activeTool === 'paint' && isLeft) {
        paintDrag.current = { x: raw.x, y: raw.y };
        useToolStore.getState().setDraftPoints([{ x: raw.x, y: raw.y }]);
        useToolStore.getState().setCursorPagePoint({ x: raw.x, y: raw.y });
        return;
      }

      // right click = ยกเลิก draft (เฉพาะตอนวาด)
      if (isRight && draftPoints.length > 0) {
        e.evt.preventDefault();
        useToolStore.getState().clearDraft();
        return;
      }

      // right-click ขณะ grid = ยกเลิกจุดเริ่มเส้นที่ค้าง
      if (isRight && activeTool === 'grid') {
        e.evt.preventDefault();
        useToolStore.getState().setGridPendingStart(null);
        return;
      }

      // right-click ขณะ dimension = ยกเลิกจุดเริ่มเส้นที่ค้าง (R1-C8b)
      if (isRight && activeTool === 'dimension') {
        e.evt.preventDefault();
        useToolStore.getState().setDimPendingStart(null);
        return;
      }

      // drawing tools — left click only
      if (!isLeft) return;

      const { final } = processCursor(raw);

      // ─── grid (inc2): คลิกแรก=ตั้งจุดเริ่ม · คลิกสอง=ปิดเส้น push เข้า gridLines ──
      // ใช้ final (จุดเดียวกับ cursor HUD ที่ผ่าน snap) — grid ไม่อยู่ใน gate ortho จึงยังไม่ ortho (inc3)
      if (activeTool === 'grid') {
        const pending = useToolStore.getState().gridPendingStart;
        if (!pending) {
          useToolStore.getState().setGridPendingStart(final);
        } else {
          useToolStore.getState().addGridLine({ a: pending, b: final });
          useToolStore.getState().setGridPendingStart(null);
        }
        return;
      }

      // ─── dimension (R1-C8b): คลิกแรก=จุดเริ่ม · คลิกสอง=ปิดเส้น valueM=null (C8c กรอกค่าทีหลัง) ──
      // มิเรอร์ grid 2-คลิก · ใช้ final (ผ่าน snap node) · ortho H/V deferred (snap node ก็ได้เส้นตรงแกน)
      if (activeTool === 'dimension') {
        const pending = useToolStore.getState().dimPendingStart;
        if (!pending) {
          useToolStore.getState().setDimPendingStart(final);
        } else {
          useToolStore.getState().addDimLine({ a: pending, b: final, valueM: null });
          useToolStore.getState().setDimPendingStart(null);
        }
        return;
      }

      // ─── scale tool ────────────────────────────────────────────────
      if (activeTool === 'scale') {
        if (draftPoints.length === 0) {
          useToolStore.getState().addDraftPoint(final);
        } else if (draftPoints.length === 1) {
          // จุดที่ 2 — เปิด dialog ทันที
          const p1 = draftPoints[0]!;
          setScaleDialog({ p1, p2: final });
          useToolStore.getState().setDraftPoints([p1, final]);
        }
        return;
      }

      // ─── area: คลิกใกล้จุดแรก = ปิด polygon แล้ว commit ──────────────
      if (activeTool === 'area') {
        if (draftPoints.length >= 3) {
          const first = draftPoints[0]!;
          const closeR = 12 / transformZoom;
          if (Math.hypot(final.x - first.x, final.y - first.y) <= closeR) {
            const profile =
              useScaleStore.getState().byPageId[page.id] ?? null;
            commitDraft('area', page.id, draftPoints, profile);
            return;
          }
        }
        useToolStore.getState().addDraftPoint(final);
        return;
      }

      // ─── length / count ────────────────────────────────────────────
      if (activeTool === 'length' || activeTool === 'count') {
        useToolStore.getState().addDraftPoint(final);
        return;
      }
    },
    [
      page,
      activeTool,
      draftPoints,
      pointerToPage,
      processCursor,
      stageRef,
      transformZoom,
    ],
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!page) return;

      // pan
      if (dragState.current) {
        const dx = e.evt.clientX - dragState.current.x;
        const dy = e.evt.clientY - dragState.current.y;
        dragState.current = { x: e.evt.clientX, y: e.evt.clientY };
        useViewportStore.getState().panBy(page.id, dx, dy);
        return;
      }

      const raw = pointerToPage();
      if (!raw) return;

      useCursorStore.getState().setPagePos(raw.x, raw.y);

      // process snap+ortho เฉพาะตอนวาด หรือ snap ตลอดเวลา? — ทำตลอด เพื่อให้ผู้ใช้เห็น HUD
      const { final, snap } = processCursor(raw);
      setCurrentSnap(snap);
      useToolStore.getState().setCursorPagePoint(final);

      // ลากย้าย member ที่เลือก → วางตามจุด snap (final) ลบ offset จุดจับ
      if (moveDrag.current) {
        const md = moveDrag.current;
        useDetectionStore
          .getState()
          .moveMember(md.id, final.x - md.dx, final.y - md.dy, md.firstMove);
        md.firstMove = false;
        return;
      }

      // hover member (paint/select) → pill ขึ้นเฉพาะตัวที่ชี้
      if (activeTool === 'paint' || activeTool === 'select') {
        const det = useDetectionStore.getState();
        const hover = findMemberAt(
          det.getForPage(page.id),
          raw,
          10 / transformZoom,
        );
        if (det.hoveredId !== (hover?.id ?? null)) {
          det.setHovered(hover?.id ?? null);
        }
      }
    },
    [page, activeTool, pointerToPage, processCursor, transformZoom],
  );

  const handleMouseUp = useCallback(() => {
    // ─── จบการลากย้าย member ───────────────────────────────────────────
    if (moveDrag.current) {
      moveDrag.current = null;
      if (stageRef.current) {
        stageRef.current.container().style.cursor = 'default';
      }
      return;
    }

    // ─── paint tool — จบการลากกล่อง: ลากใหญ่พอ = สร้าง member, ไม่งั้น = คลิกเลือก ─
    if (paintDrag.current && page) {
      const start = paintDrag.current;
      paintDrag.current = null;
      const end = useToolStore.getState().cursorPagePoint ?? start;
      useToolStore.getState().clearDraft();

      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      const dragMinPage = 6 / transformZoom; // ~6 screen px
      const det = useDetectionStore.getState();
      det.setPaintError(null); // เคลียร์ hint จากโหมดแก้

      if (w >= dragMinPage && h >= dragMinPage) {
        // ลากกรอบ → สร้าง member ใช้สี paintColor · ชื่อตั้งทีหลังในแผงแก้
        const mk = det.paintMark;
        const id = det.addMember({
          pageId: page.id,
          mark: mk,
          category: categoryForMark(mk),
          geometry: {
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            w,
            h,
          },
          color: det.paintColor,
          source: 'drag',
          status: 'draft',
        });
        det.setSelection([id]);
      } else {
        // คลิก (ไม่ลาก): โดน member เดิม → toggle · ว่าง → ปัก pin (ไม่ OCR อัตโนมัติ)
        const hit = findMemberAt(
          det.getForPage(page.id),
          end,
          10 / transformZoom,
        );
        if (hit) {
          det.toggleSelect(hit.id);
        } else {
          // pin เล็กที่จุดคลิก (~28 screen px) — สี = paintColor, ชื่อว่าง, draft, เลือกไว้
          const sizePage = 28 / transformZoom;
          const id = det.addMember({
            pageId: page.id,
            mark: '',
            category: 'other',
            geometry: {
              x: end.x - sizePage / 2,
              y: end.y - sizePage / 2,
              w: sizePage,
              h: sizePage,
            },
            color: det.paintColor,
            source: 'pick',
            status: 'draft',
          });
          det.setSelection([id]);
        }
      }
    }

    dragState.current = null;
    if (stageRef.current) {
      stageRef.current.container().style.cursor = 'default';
    }
  }, [page, transformZoom, stageRef]);

  const handleMouseLeave = useCallback(() => {
    dragState.current = null;
    paintDrag.current = null;
    moveDrag.current = null;
    setCurrentSnap(null);
    useCursorStore.getState().clear();
    useDetectionStore.getState().setHovered(null);
    useToolStore.getState().setCursorPagePoint(null);
    if (stageRef.current) {
      stageRef.current.container().style.cursor = 'default';
    }
  }, [stageRef]);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      if (!page) return;
      const stage = stageRef.current;
      if (!stage) return;
      const ptr = stage.getPointerPosition();
      if (!ptr) return;
      // zoom แบบ proportional ตามความเร็วล้อ → ลื่นกว่า step คงที่
      const factor = Math.min(
        WHEEL_ZOOM_MAX,
        Math.max(WHEEL_ZOOM_MIN, Math.exp(-e.evt.deltaY * WHEEL_ZOOM_SENSITIVITY)),
      );
      useViewportStore.getState().zoomAt(page.id, factor, ptr.x, ptr.y);
    },
    [page, stageRef],
  );

  const handleDoubleClick = useCallback(() => {
    if (!page) return;
    // dblclick = commit polyline (length) — area ต้องคลิกจุดแรกซ้ำ หรือ Enter
    if (activeTool === 'length' && draftPoints.length >= 2) {
      const profile = useScaleStore.getState().byPageId[page.id] ?? null;
      commitDraft(activeTool, page.id, draftPoints, profile);
    }
  }, [page, activeTool, draftPoints]);

  const commitDraftAction = useCallback(() => {
    if (!page) return;
    const profile = useScaleStore.getState().byPageId[page.id] ?? null;
    commitDraft(activeTool, page.id, draftPoints, profile);
  }, [page, activeTool, draftPoints]);

  const cancelDraftAction = useCallback(() => {
    useToolStore.getState().clearDraft();
    setScaleDialog(null);
    const det = useDetectionStore.getState();
    det.clearSelection();
    det.setHovered(null);
  }, []);

  const closeScaleDialog = useCallback(() => {
    setScaleDialog(null);
  }, []);

  return useMemo(
    () => ({
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleMouseLeave,
      handleWheel,
      handleDoubleClick,
      currentSnap,
      scaleDialog,
      closeScaleDialog,
      commitDraftAction,
      cancelDraftAction,
    }),
    [
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleMouseLeave,
      handleWheel,
      handleDoubleClick,
      currentSnap,
      scaleDialog,
      closeScaleDialog,
      commitDraftAction,
      cancelDraftAction,
    ],
  );
}
