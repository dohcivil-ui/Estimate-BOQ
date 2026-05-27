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
import { applyOrthoLock } from '@/core/orthoLock';
import { findSnap, type SnapPoint } from '@/core/snap';
import { findDarkPixelNear } from '@/core/imageEdges';
import { useToolStore } from '@/stores/toolStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useOrthoStore } from '@/stores/orthoStore';
import { useSnapStore, getImageThreshold } from '@/stores/snapStore';
import { useScaleStore } from '@/stores/scaleStore';
import { useCursorStore } from '@/stores/cursorStore';
import { useImageDataStore, extractRasterData } from '@/stores/imageDataStore';
import { useMeasurementStore } from '@/stores/measurementStore';
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

  const dragState = useRef<{ x: number; y: number } | null>(null);
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

      // select tool — left click = hit test
      if (activeTool === 'select' && isLeft) {
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

      // right click = ยกเลิก draft (เฉพาะตอนวาด)
      if (isRight && draftPoints.length > 0) {
        e.evt.preventDefault();
        useToolStore.getState().clearDraft();
        return;
      }

      // drawing tools — left click only
      if (!isLeft) return;

      const { final } = processCursor(raw);

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
    },
    [page, pointerToPage, processCursor],
  );

  const handleMouseUp = useCallback(() => {
    dragState.current = null;
    if (stageRef.current) {
      stageRef.current.container().style.cursor = 'default';
    }
  }, [stageRef]);

  const handleMouseLeave = useCallback(() => {
    dragState.current = null;
    setCurrentSnap(null);
    useCursorStore.getState().clear();
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
