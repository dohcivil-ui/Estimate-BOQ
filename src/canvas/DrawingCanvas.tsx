// src/canvas/DrawingCanvas.tsx — Konva viewer + measurement tools (spec §3.1, §5, §6, §9.2–§9.6, §10)
//
// กฎเหล็กที่บังคับใช้:
//  #1 geometry ของ measurement เก็บเป็น page-coord เสมอ (page-pixel canonical)
//  #2 hit-test ทำใน screen-coord (รัศมีคงที่ตอน zoom) — แปลง page→screen ก่อนเทียบ
//  #3 quantity ไหลผ่าน src/core/formula.ts เท่านั้น (ผ่าน measurementStore.computeQuantity)
import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import { pageToScreen, screenToPage } from '../core/coords';
import { distancePx } from '../core/geometry';
import { lineQuantity, polygonQuantity, rectQuantity } from '../core/formula';
import {
  pointInPolygon,
  nearestNodeIndex,
  nearestSegmentIndex,
} from '../core/hittest';
import { useDrawingStore } from '../stores/drawingStore';
import { useViewportStore } from '../stores/viewportStore';
import { useToolStore } from '../stores/toolStore';
import { useCursorStore } from '../stores/cursorStore';
import { useScaleStore } from '../stores/scaleStore';
import { useMeasurementStore } from '../stores/measurementStore';
import { useDrawingDraftStore } from '../stores/drawingDraftStore';
import { useBOQStore } from '../stores/boqStore';
import { deleteSelectedWithCascade } from '../services/measurementOps';
import type { Measurement, MeasurementGeometry, PagePoint } from '../types';

type Props = { width: number; height: number };

const ZOOM_STEP = 1.1;
const CLICK_THRESHOLD_PX = 4; // spec §7.2
const NODE_HIT_RADIUS_SCREEN = 8; // spec §7.2 (6–10)
const SEGMENT_HIT_TOL_SCREEN = 6; // spec §7.2 (4–8)
const RECT_MIN_SIZE_PX = 2; // หลีกเลี่ยง rect เล็กเกินจากการคลิกพลาด
const CLOSE_PATH_THRESHOLD_PX = 4; // คลิกใกล้ node เดิม < นี้ ถือเป็นสัญญาณ commit (= dblclick)

// สีตามสเปก §8.1
const COLOR = {
  draft: '#ffd44d', // เหลือง
  confirmed: '#5b9dff', // ฟ้า
  selected: '#ff9e3d', // ส้ม highlight
  count: '#7dd87d', // เขียวสด สำหรับ count marker
};

/** geometry → จุดทั้งหมด (page-coord) — ใช้ render + hit-test + bbox */
function geometryPoints(g: MeasurementGeometry): PagePoint[] {
  switch (g.kind) {
    case 'point':
      return [g.point];
    case 'line':
      return [g.points[0], g.points[1]];
    case 'polyline':
    case 'polygon':
    case 'lasso':
      return g.points;
    case 'rectangle':
      return [
        { x: g.x, y: g.y },
        { x: g.x + g.width, y: g.y },
        { x: g.x + g.width, y: g.y + g.height },
        { x: g.x, y: g.y + g.height },
      ];
  }
}

function bboxOf(pts: PagePoint[]): { x: number; y: number; w: number; h: number } | null {
  if (pts.length === 0) return null;
  let minX = pts[0]!.x;
  let minY = pts[0]!.y;
  let maxX = minX;
  let maxY = minY;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** normalize rect → x/y/w/h ที่ width/height ≥ 0 เสมอ (ป้องกัน area ติดลบ ก่อนเข้า formula) */
function normalizeRect(a: PagePoint, b: PagePoint) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const width = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);
  return { x, y, width, height };
}

export function DrawingCanvas({ width, height }: Props) {
  const page = useDrawingStore((s) => s.pages.find((p) => p.id === s.activePageId) ?? null);
  const transform = useViewportStore((s) =>
    page ? (s.byPageId[page.id] ?? null) : null,
  );
  const fit = useViewportStore((s) => s.fit);
  const zoomAt = useViewportStore((s) => s.zoomAt);
  const panBy = useViewportStore((s) => s.panBy);
  const tool = useToolStore((s) => s.current);
  const setCursor = useCursorStore((s) => s.setCursor);
  const scaleDraft = useScaleStore((s) => s.draft);
  const scaleProfile = useScaleStore((s) => (page ? s.byPageId[page.id] ?? null : null));
  const startScaleDraft = useScaleStore((s) => s.startDraft);
  const commitScaleP2 = useScaleStore((s) => s.commitP2);
  const cancelScaleDraft = useScaleStore((s) => s.cancelDraft);

  // measurement state
  const measurementsForPage = useMeasurementStore((s) =>
    page ? (s.byPageId[page.id] ?? []).map((id) => s.byId[id]!).filter(Boolean) : [],
  );
  const selectedIds = useMeasurementStore((s) => s.selectedIds);
  const addMeasurement = useMeasurementStore((s) => s.addMeasurement);
  const updateGeometry = useMeasurementStore((s) => s.updateGeometry);
  const selectAction = useMeasurementStore((s) => s.select);
  const toggleSelectAction = useMeasurementStore((s) => s.toggleSelect);
  const clearSelection = useMeasurementStore((s) => s.clearSelection);
  const undo = useMeasurementStore((s) => s.undo);
  const redo = useMeasurementStore((s) => s.redo);
  const countCategory = useMeasurementStore((s) => s.countCategory);
  // BOQ highlight: เมื่อ user click/hover BOQ row → highlight measurement ที่ผูก
  const boqSelectedId = useBOQStore((s) => s.selectedBOQId);
  const boqHoverId = useBOQStore((s) => s.hoverBOQId);
  const boqLinks = useBOQStore((s) => s.links);

  // drawing tool draft
  const draft = useDrawingDraftStore((s) => s.draft);
  const startPath = useDrawingDraftStore((s) => s.startPath);
  const appendPath = useDrawingDraftStore((s) => s.appendPath);
  const popPathNode = useDrawingDraftStore((s) => s.popPathNode);
  const startRectDraft = useDrawingDraftStore((s) => s.startRect);
  const updateRectDraft = useDrawingDraftStore((s) => s.updateRect);
  const cancelDraft = useDrawingDraftStore((s) => s.cancel);

  const stageRef = useRef<Konva.Stage | null>(null);
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const mouseDownAtRef = useRef<{ x: number; y: number } | null>(null);
  const spaceDownRef = useRef(false);
  /** node ที่กำลังลาก — { measurementId, nodeIndex } */
  const nodeDragRef = useRef<{
    measurementId: string;
    nodeIndex: number;
    /** สำหรับ rectangle: เก็บ 4 มุมในรูป array สำหรับการคำนวณ resize */
    rectMode?: 'tl' | 'tr' | 'br' | 'bl';
  } | null>(null);
  /** flag ว่าระหว่าง mouseDown→mouseUp มี drag เกิดขึ้น → ไม่ trigger click commit */
  const movedRef = useRef(false);
  const [cursorPage, setCursorPage] = useState<PagePoint | null>(null);

  // helper — สำหรับเปรียบเทียบ screen
  const t = transform ?? { zoom: 1, panX: 0, panY: 0, rotationDeg: 0 as const };
  const upp = scaleProfile?.unitPerPixel ?? null;

  // auto-fit เมื่อเปลี่ยนหน้า (เหมือน Phase 1)
  useEffect(() => {
    if (!page) return;
    if (transform) return;
    fit(page.id, width, height, page.pageWidth, page.pageHeight);
  }, [page, transform, width, height, fit]);

  // ----- keyboard (spec §6.1) -----
  useEffect(() => {
    const isEditableTarget = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
    };

    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isEditableTarget(e)) {
        spaceDownRef.current = true;
        return;
      }
      // Undo/Redo (ทำงานแม้ไม่อยู่ใน editable target, แต่ไม่ทับ form input)
      if (!isEditableTarget(e) && (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (isEditableTarget(e)) return;

      if (e.code === 'Escape') {
        if (scaleDraft.phase !== 'idle') cancelScaleDraft();
        if (draft.phase !== 'idle') cancelDraft();
        clearSelection();
        return;
      }
      if (e.code === 'Enter') {
        commitDraftFromKeyboard();
        return;
      }
      if (e.code === 'Backspace') {
        if (draft.phase === 'drawing' && draft.kind !== 'rect') {
          e.preventDefault();
          popPathNode();
        }
        return;
      }
      if (e.code === 'Delete') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          deleteSelectedWithCascade();
        }
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scaleDraft.phase,
    draft,
    selectedIds.length,
    undo,
    redo,
    cancelScaleDraft,
    cancelDraft,
    clearSelection,
    popPathNode,
  ]);

  // เปลี่ยน tool → cancel draft ที่ค้าง (ไม่ตัด selection — ผู้ใช้อาจสลับ Pan ไปกลับ)
  useEffect(() => {
    if (tool !== 'scale' && scaleDraft.phase !== 'idle') cancelScaleDraft();
    if (
      draft.phase === 'drawing' &&
      !toolMatchesDraft(tool, draft.kind)
    ) {
      cancelDraft();
    }
    if (tool !== 'select') {
      clearSelection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  function commitDraftFromKeyboard() {
    if (draft.phase !== 'drawing') return;
    if (!page) return;
    if (draft.kind === 'polyline' && draft.points.length >= 2) {
      commitPathDraft();
    } else if (draft.kind === 'polygon' && draft.points.length >= 3) {
      commitPathDraft();
    } else if (draft.kind === 'line' && draft.points.length === 2) {
      commitPathDraft();
    }
  }

  function commitPathDraft() {
    if (draft.phase !== 'drawing') return;
    if (draft.kind === 'rect') return;
    if (!page) return;
    let geometry: MeasurementGeometry;
    let mtype: Measurement['type'];
    if (draft.kind === 'line') {
      if (draft.points.length < 2) return;
      geometry = { kind: 'line', points: [draft.points[0]!, draft.points[1]!] };
      mtype = 'line';
    } else if (draft.kind === 'polyline') {
      if (draft.points.length < 2) return;
      geometry = { kind: 'polyline', points: [...draft.points] };
      mtype = 'polyline';
    } else {
      // polygon
      if (draft.points.length < 3) return;
      geometry = { kind: 'polygon', points: [...draft.points] };
      mtype = 'polygon_area';
    }
    addMeasurement({
      type: mtype,
      drawingPageId: page.id,
      geometry,
      scaleId: page.id, // MVP: scaleId = pageId (1-to-1)
      unitPerPixel: upp,
    });
    cancelDraft();
  }

  function commitRectDraft() {
    if (draft.phase !== 'drawing' || draft.kind !== 'rect') return;
    if (!page) return;
    const { x, y, width, height } = normalizeRect(draft.start, draft.current);
    if (width < RECT_MIN_SIZE_PX || height < RECT_MIN_SIZE_PX) {
      cancelDraft();
      return;
    }
    addMeasurement({
      type: 'rectangle_area',
      drawingPageId: page.id,
      geometry: { kind: 'rectangle', x, y, width, height },
      scaleId: page.id,
      unitPerPixel: upp,
    });
    cancelDraft();
  }

  if (!page) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          background: '#1a1a1a',
          fontSize: 14,
        }}
      >
        ยังไม่มีแบบ — กด "เปิดไฟล์" เพื่อ import PDF/JPG/PNG
      </div>
    );
  }

  // ---------- ตัวช่วย hit-test (screen-coord ตาม Golden Rule #2) ----------
  function hitTestSelect(screenPt: { x: number; y: number }): {
    measurementId: string;
    nodeIndex?: number;
    rectCorner?: 'tl' | 'tr' | 'br' | 'bl';
  } | null {
    // priority §10.1: node handle > marker > segment > polygon fill > region rect
    // 1) node handle (รวมถึงมุม rect)
    for (const m of measurementsForPage) {
      const pts = geometryPoints(m.geometry);
      const screenPts = pts.map((p) => pageToScreen(p, t));
      const idx = nearestNodeIndex(screenPt, screenPts, NODE_HIT_RADIUS_SCREEN);
      if (idx >= 0) {
        if (m.geometry.kind === 'rectangle') {
          const corner = (['tl', 'tr', 'br', 'bl'] as const)[idx];
          return { measurementId: m.id, nodeIndex: idx, rectCorner: corner };
        }
        return { measurementId: m.id, nodeIndex: idx };
      }
    }
    // 2) marker / count point
    for (const m of measurementsForPage) {
      if (m.geometry.kind !== 'point') continue;
      const sp = pageToScreen(m.geometry.point, t);
      if (Math.hypot(sp.x - screenPt.x, sp.y - screenPt.y) <= NODE_HIT_RADIUS_SCREEN) {
        return { measurementId: m.id };
      }
    }
    // 3) line/polyline segment
    for (const m of measurementsForPage) {
      if (m.geometry.kind !== 'line' && m.geometry.kind !== 'polyline') continue;
      const pts = geometryPoints(m.geometry).map((p) => pageToScreen(p, t));
      const segIdx = nearestSegmentIndex(screenPt, pts, SEGMENT_HIT_TOL_SCREEN, false);
      if (segIdx >= 0) return { measurementId: m.id };
    }
    // 4) polygon fill
    for (const m of measurementsForPage) {
      if (m.geometry.kind !== 'polygon') continue;
      const pts = geometryPoints(m.geometry).map((p) => pageToScreen(p, t));
      if (pointInPolygon(screenPt, pts)) return { measurementId: m.id };
    }
    // 5) rectangle fill / edges
    for (const m of measurementsForPage) {
      if (m.geometry.kind !== 'rectangle') continue;
      const pts = geometryPoints(m.geometry).map((p) => pageToScreen(p, t));
      // ขอบ rect
      const segIdx = nearestSegmentIndex(screenPt, pts, SEGMENT_HIT_TOL_SCREEN, true);
      if (segIdx >= 0) return { measurementId: m.id };
      // fill (point in 4-corner polygon)
      if (pointInPolygon(screenPt, pts)) return { measurementId: m.id };
    }
    return null;
  }

  // ---------- pointer handlers ----------
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const factor = e.evt.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomAt(page.id, factor, pointer.x, pointer.y);
  };

  const wantsPanDrag = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const native = e.evt as MouseEvent | undefined;
    if (tool === 'pan') return true;
    if (spaceDownRef.current) return true;
    if (native && 'button' in native && native.button === 1) return true;
    return false;
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    movedRef.current = false;
    if (wantsPanDrag(e)) {
      e.evt.preventDefault();
      isPanningRef.current = true;
      lastPointerRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      mouseDownAtRef.current = null;
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const pp = screenToPage(pointer, t);

    // Select tool: ตรวจ node-handle ก่อน — กดที่ node = เริ่ม drag node
    if (tool === 'select') {
      const hit = hitTestSelect(pointer);
      if (hit?.nodeIndex !== undefined) {
        // เลือก measurement นี้ + ลาก node
        selectAction([hit.measurementId]);
        nodeDragRef.current = {
          measurementId: hit.measurementId,
          nodeIndex: hit.nodeIndex,
          rectMode: hit.rectCorner,
        };
        return;
      }
    }

    // Rectangle tool: เริ่ม drag rect
    if (tool === 'rect') {
      startRectDraft(page.id, pp);
      mouseDownAtRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }

    // อื่นๆ: เก็บ position ไว้แยก click vs drag ใน mouseUp
    mouseDownAtRef.current = { x: e.evt.clientX, y: e.evt.clientY };
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    if (isPanningRef.current && lastPointerRef.current) {
      const dx = e.evt.clientX - lastPointerRef.current.x;
      const dy = e.evt.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      panBy(page.id, dx, dy);
      return;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) {
      setCursor(null);
      setCursorPage(null);
      return;
    }
    const pp = screenToPage(pointer, t);
    setCursor(pp);
    setCursorPage(pp);

    // mark movedRef ถ้าเกิน threshold (สำหรับ rect drag → ใช้ตัดสิน commit)
    if (mouseDownAtRef.current) {
      const moved = Math.hypot(
        e.evt.clientX - mouseDownAtRef.current.x,
        e.evt.clientY - mouseDownAtRef.current.y,
      );
      if (moved >= CLICK_THRESHOLD_PX) movedRef.current = true;
    }

    // node drag (select tool) — อัพเดต geometry แบบ live, recompute quantity ผ่าน formula
    if (nodeDragRef.current) {
      const { measurementId, nodeIndex, rectMode } = nodeDragRef.current;
      const m = useMeasurementStore.getState().byId[measurementId];
      if (!m) return;
      const g = m.geometry;
      if (g.kind === 'point') {
        updateGeometry(measurementId, { kind: 'point', point: pp }, upp);
      } else if (g.kind === 'line') {
        const next: [PagePoint, PagePoint] = [g.points[0], g.points[1]];
        if (nodeIndex === 0) next[0] = pp;
        else next[1] = pp;
        updateGeometry(measurementId, { kind: 'line', points: next }, upp);
      } else if (g.kind === 'polyline' || g.kind === 'polygon' || g.kind === 'lasso') {
        const next = g.points.slice();
        next[nodeIndex] = pp;
        updateGeometry(measurementId, { ...g, points: next }, upp);
      } else if (g.kind === 'rectangle' && rectMode) {
        // คำนวณมุมตรงข้าม → normalize
        const corners = {
          tl: { x: g.x, y: g.y },
          tr: { x: g.x + g.width, y: g.y },
          br: { x: g.x + g.width, y: g.y + g.height },
          bl: { x: g.x, y: g.y + g.height },
        };
        const opp = rectMode === 'tl' ? corners.br : rectMode === 'tr' ? corners.bl : rectMode === 'br' ? corners.tl : corners.tr;
        const n = normalizeRect(opp, pp);
        updateGeometry(measurementId, { kind: 'rectangle', ...n }, upp);
      }
      return;
    }

    // rect tool drag preview
    if (tool === 'rect' && draft.phase === 'drawing' && draft.kind === 'rect') {
      updateRectDraft(pp);
    }
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      lastPointerRef.current = null;
      return;
    }
    // จบ node drag
    if (nodeDragRef.current) {
      nodeDragRef.current = null;
      mouseDownAtRef.current = null;
      return;
    }
    // จบ rect drag → commit
    if (tool === 'rect' && draft.phase === 'drawing' && draft.kind === 'rect') {
      if (movedRef.current) {
        commitRectDraft();
        mouseDownAtRef.current = null;
        return;
      }
      // ไม่ได้ลาก → ยกเลิก draft
      cancelDraft();
      mouseDownAtRef.current = null;
      return;
    }

    const down = mouseDownAtRef.current;
    mouseDownAtRef.current = null;
    if (!down) return;
    const moved = Math.hypot(e.evt.clientX - down.x, e.evt.clientY - down.y);
    if (moved >= CLICK_THRESHOLD_PX) return; // drag, ไม่นับเป็น click
    onCanvasClick(e.evt);
  };

  const handleMouseLeave = () => {
    isPanningRef.current = false;
    lastPointerRef.current = null;
    mouseDownAtRef.current = null;
    // ไม่ล้าง node drag — ผู้ใช้อาจ release นอก canvas
    setCursor(null);
    setCursorPage(null);
  };

  // Konva dblclick — ใช้สำหรับ polyline/polygon commit ที่ชัดเจน
  const handleDblClick = () => {
    if (draft.phase !== 'drawing') return;
    if (draft.kind === 'polyline' && draft.points.length >= 2) commitPathDraft();
    else if (draft.kind === 'polygon' && draft.points.length >= 3) commitPathDraft();
  };

  function onCanvasClick(native: MouseEvent) {
    if (!cursorPage) return;

    // SCALE TOOL — โค้ดเดิม
    if (tool === 'scale') {
      if (scaleDraft.phase === 'idle') {
        startScaleDraft(page!.id, cursorPage);
      } else if (
        scaleDraft.phase === 'awaitingP2' &&
        scaleDraft.pageId === page!.id
      ) {
        commitScaleP2(cursorPage);
      }
      return;
    }

    // SELECT TOOL
    if (tool === 'select') {
      const stage = stageRef.current;
      const pointer = stage?.getPointerPosition();
      if (!pointer) return;
      const hit = hitTestSelect(pointer);
      if (hit) {
        toggleSelectAction(hit.measurementId, native.shiftKey);
      } else {
        clearSelection();
      }
      return;
    }

    // LINE
    if (tool === 'line') {
      if (draft.phase === 'idle') {
        startPath('line', page!.id, cursorPage);
      } else if (
        draft.phase === 'drawing' &&
        draft.kind === 'line' &&
        draft.pageId === page!.id
      ) {
        appendPath(cursorPage);
        // commit ทันทีหลังจุดที่สอง
        // ใช้ setTimeout เพื่อให้ store update ก่อน — แต่จริงๆ commitPathDraft อ่าน store ใหม่ได้
        const updated = useDrawingDraftStore.getState().draft;
        if (
          updated.phase === 'drawing' &&
          updated.kind === 'line' &&
          updated.points.length >= 2
        ) {
          commitPathDraftFromStore();
        }
      }
      return;
    }

    // POLYLINE / POLYGON
    if (tool === 'polyline' || tool === 'area') {
      const kind = tool === 'polyline' ? 'polyline' : 'polygon';
      if (draft.phase === 'idle') {
        startPath(kind, page!.id, cursorPage);
        return;
      }
      if (draft.phase === 'drawing' && draft.kind === kind && draft.pageId === page!.id) {
        // ตรวจคลิกใกล้ node ล่าสุดในระยะ screen — = สัญญาณ commit (เทียบเท่า dblclick)
        const lastPt = draft.points[draft.points.length - 1]!;
        const lastScreen = pageToScreen(lastPt, t);
        const curScreen = pageToScreen(cursorPage, t);
        const distScreen = Math.hypot(lastScreen.x - curScreen.x, lastScreen.y - curScreen.y);
        if (distScreen < CLOSE_PATH_THRESHOLD_PX) {
          if (kind === 'polyline' && draft.points.length >= 2) commitPathDraft();
          else if (kind === 'polygon' && draft.points.length >= 3) commitPathDraft();
          return;
        }
        appendPath(cursorPage);
      }
      return;
    }

    // COUNT — วาง marker เลย
    if (tool === 'count') {
      if (!page) return;
      addMeasurement({
        type: 'count_marker',
        drawingPageId: page.id,
        geometry: { kind: 'point', point: cursorPage },
        scaleId: page.id,
        unitPerPixel: upp,
        categoryId: countCategory,
      });
      return;
    }
  }

  function commitPathDraftFromStore() {
    // ใช้กับ "line" หลัง append จุดที่สอง — อ่าน draft จาก store แล้ว commit ทันที
    const d = useDrawingDraftStore.getState().draft;
    if (d.phase !== 'drawing' || d.kind === 'rect') return;
    const points = d.points;
    if (d.kind === 'line' && points.length >= 2) {
      addMeasurement({
        type: 'line',
        drawingPageId: page!.id,
        geometry: { kind: 'line', points: [points[0]!, points[1]!] },
        scaleId: page!.id,
        unitPerPixel: upp,
      });
      cancelDraft();
    }
  }

  // ---- preview values for scale tool (เหมือนเดิม) ----
  const scaleP1 =
    scaleDraft.phase === 'awaitingP2' && scaleDraft.pageId === page.id
      ? scaleDraft.p1
      : null;
  const previewP2 = scaleP1 && cursorPage ? cursorPage : null;
  const previewPixelDistance = useMemo(() => {
    if (!scaleP1 || !previewP2) return null;
    return distancePx(scaleP1, previewP2);
  }, [scaleP1, previewP2]);

  let previewLabelPos: { x: number; y: number } | null = null;
  let previewLabelText = '';
  if (scaleP1 && previewP2 && previewPixelDistance !== null) {
    const mid: PagePoint = {
      x: (scaleP1.x + previewP2.x) / 2,
      y: (scaleP1.y + previewP2.y) / 2,
    };
    previewLabelPos = pageToScreen(mid, t);
    const realPreview =
      scaleProfile && scaleProfile.unitPerPixel > 0
        ? `${(previewPixelDistance * scaleProfile.unitPerPixel).toFixed(3)} m · `
        : '';
    previewLabelText = `${realPreview}${previewPixelDistance.toFixed(1)} px`;
  }

  // เส้น reference ของ scale ที่ตั้งไว้แล้ว
  const refP1 = scaleProfile?.p1 ?? null;
  const refP2 = scaleProfile?.p2 ?? null;

  // ---- draft measurement preview (line/polyline/polygon/rect) ----
  // ทุกการคำนวณ quantity ต้องผ่าน core/formula.ts เท่านั้น (Golden Rule #3)
  // ห้าม inline สูตร พื้นที่/ความยาว/ยกกำลังสอง ในคอมโพเนนต์
  const draftPreview = useMemo(() => {
    if (draft.phase !== 'drawing') return null;
    if (!cursorPage) return null;
    if (draft.kind === 'rect') {
      const r = normalizeRect(draft.start, draft.current);
      const q = upp != null ? rectQuantity(r.width, r.height, upp) : null;
      return {
        kind: 'rect' as const,
        rect: r,
        quantity: q,
      };
    }
    // line/polyline/polygon — เพิ่ม cursor เป็น "ghost node" ปลายทาง
    const pts = [...draft.points, cursorPage];
    if (draft.kind === 'line' && pts.length > 2) pts.length = 2;
    let quantity: number | null = null;
    if (upp != null) {
      if (draft.kind === 'polygon' && pts.length >= 3) {
        quantity = polygonQuantity(pts, upp);
      } else if (pts.length >= 2) {
        quantity = lineQuantity(pts, upp);
      }
    }
    return {
      kind: draft.kind,
      points: pts,
      committedPoints: draft.points,
      quantity,
    };
  }, [draft, cursorPage, upp]);

  // count markers grouping (index ภายในกลุ่มสำหรับ display เลข)
  const countLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    const counts: Record<string, number> = {};
    for (const m of measurementsForPage) {
      if (m.type !== 'count_marker') continue;
      const cat = m.categoryId ?? 'unset';
      counts[cat] = (counts[cat] ?? 0) + 1;
      labels[m.id] = `${cat}-${counts[cat]}`;
    }
    return labels;
  }, [measurementsForPage]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  /**
   * Set ของ measurement ที่ถูก BOQ "selected" → highlight แรงเท่า selection
   * Set ของ measurement ที่ถูก BOQ "hover"    → highlight อ่อน (preview)
   */
  const boqHighlightSets = useMemo(() => {
    const strong = new Set<string>();
    const soft = new Set<string>();
    if (boqSelectedId) {
      for (const l of boqLinks) if (l.boqItemId === boqSelectedId) strong.add(l.measurementId);
    }
    if (boqHoverId && boqHoverId !== boqSelectedId) {
      for (const l of boqLinks) if (l.boqItemId === boqHoverId) soft.add(l.measurementId);
    }
    return { strong, soft };
  }, [boqSelectedId, boqHoverId, boqLinks]);

  return (
    <div style={{ position: 'relative', width, height }}>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        x={t.panX}
        y={t.panY}
        scaleX={t.zoom}
        scaleY={t.zoom}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDblClick={handleDblClick}
        style={{
          background: '#262626',
          cursor:
            tool === 'pan' || spaceDownRef.current
              ? 'grab'
              : tool === 'scale' || tool === 'line' || tool === 'polyline' || tool === 'area' || tool === 'rect' || tool === 'count'
                ? 'crosshair'
                : 'default',
        }}
      >
        <Layer listening={false}>
          {page.bitmap && (
            <KonvaImage
              image={page.bitmap}
              x={0}
              y={0}
              width={page.pageWidth}
              height={page.pageHeight}
            />
          )}
        </Layer>

        {/* Layer: confirmed measurements (สีตามสเปก §8.1) */}
        <Layer listening={false}>
          {measurementsForPage.map((m) => {
            const isSelected = selectedSet.has(m.id) || boqHighlightSets.strong.has(m.id);
            const isSoftHi = boqHighlightSets.soft.has(m.id);
            const stroke = isSelected ? COLOR.selected : isSoftHi ? '#ffd44d' : COLOR.confirmed;
            const sw = (isSelected ? 2.5 : isSoftHi ? 2 : 1.5) / t.zoom;
            const nodeR = (isSelected ? 5 : 3.5) / t.zoom;
            const g = m.geometry;
            if (g.kind === 'point') {
              const label = countLabels[m.id] ?? '';
              return (
                <CountMarker
                  key={m.id}
                  cx={g.point.x}
                  cy={g.point.y}
                  color={isSelected ? COLOR.selected : COLOR.count}
                  zoom={t.zoom}
                  label={label}
                />
              );
            }
            if (g.kind === 'line' || g.kind === 'polyline') {
              const flat = g.points.flatMap((p) => [p.x, p.y]);
              return (
                <ShapeGroup key={m.id}>
                  <Line points={flat} stroke={stroke} strokeWidth={sw} />
                  {g.points.map((p, i) => (
                    <Circle key={i} x={p.x} y={p.y} radius={nodeR} fill={stroke} />
                  ))}
                </ShapeGroup>
              );
            }
            if (g.kind === 'polygon' || g.kind === 'lasso') {
              const flat = g.points.flatMap((p) => [p.x, p.y]);
              return (
                <ShapeGroup key={m.id}>
                  <Line
                    points={flat}
                    closed
                    stroke={stroke}
                    strokeWidth={sw}
                    fill={isSelected ? 'rgba(255,158,61,0.18)' : 'rgba(91,157,255,0.13)'}
                  />
                  {g.points.map((p, i) => (
                    <Circle key={i} x={p.x} y={p.y} radius={nodeR} fill={stroke} />
                  ))}
                </ShapeGroup>
              );
            }
            if (g.kind === 'rectangle') {
              return (
                <ShapeGroup key={m.id}>
                  <Rect
                    x={g.x}
                    y={g.y}
                    width={g.width}
                    height={g.height}
                    stroke={stroke}
                    strokeWidth={sw}
                    fill={isSelected ? 'rgba(255,158,61,0.15)' : 'rgba(91,157,255,0.10)'}
                  />
                  {[
                    { x: g.x, y: g.y },
                    { x: g.x + g.width, y: g.y },
                    { x: g.x + g.width, y: g.y + g.height },
                    { x: g.x, y: g.y + g.height },
                  ].map((p, i) => (
                    <Circle key={i} x={p.x} y={p.y} radius={nodeR} fill={stroke} />
                  ))}
                </ShapeGroup>
              );
            }
            return null;
          })}
        </Layer>

        {/* Layer: scale reference + scale draft + measurement draft */}
        <Layer listening={false}>
          {refP1 && refP2 && (
            <ShapeGroup>
              <Line
                points={[refP1.x, refP1.y, refP2.x, refP2.y]}
                stroke="#5b9dff"
                strokeWidth={1 / t.zoom}
                opacity={0.55}
                dash={[6 / t.zoom, 4 / t.zoom]}
              />
              <Circle x={refP1.x} y={refP1.y} radius={3 / t.zoom} fill="#5b9dff" opacity={0.7} />
              <Circle x={refP2.x} y={refP2.y} radius={3 / t.zoom} fill="#5b9dff" opacity={0.7} />
            </ShapeGroup>
          )}
          {scaleP1 && previewP2 && (
            <ShapeGroup>
              <Line
                points={[scaleP1.x, scaleP1.y, previewP2.x, previewP2.y]}
                stroke={COLOR.draft}
                strokeWidth={1.5 / t.zoom}
                dash={[8 / t.zoom, 4 / t.zoom]}
              />
              <Circle x={scaleP1.x} y={scaleP1.y} radius={4 / t.zoom} fill={COLOR.draft} />
              <Circle x={previewP2.x} y={previewP2.y} radius={4 / t.zoom} fill={COLOR.draft} opacity={0.8} />
            </ShapeGroup>
          )}
          {/* measurement draft preview — เส้นประเหลือง §8.1 */}
          {draftPreview && draftPreview.kind === 'rect' && (
            <ShapeGroup>
              <Rect
                x={draftPreview.rect.x}
                y={draftPreview.rect.y}
                width={draftPreview.rect.width}
                height={draftPreview.rect.height}
                stroke={COLOR.draft}
                strokeWidth={1.5 / t.zoom}
                dash={[8 / t.zoom, 4 / t.zoom]}
                fill="rgba(255,212,77,0.10)"
              />
            </ShapeGroup>
          )}
          {draftPreview && draftPreview.kind !== 'rect' && (
            <ShapeGroup>
              <Line
                points={draftPreview.points.flatMap((p) => [p.x, p.y])}
                stroke={COLOR.draft}
                strokeWidth={1.5 / t.zoom}
                dash={[8 / t.zoom, 4 / t.zoom]}
                closed={draftPreview.kind === 'polygon' && draftPreview.points.length >= 3}
                fill={
                  draftPreview.kind === 'polygon' && draftPreview.points.length >= 3
                    ? 'rgba(255,212,77,0.10)'
                    : undefined
                }
              />
              {draftPreview.committedPoints.map((p, i) => (
                <Circle key={i} x={p.x} y={p.y} radius={4 / t.zoom} fill={COLOR.draft} />
              ))}
            </ShapeGroup>
          )}
        </Layer>

        {/* Layer: measurement labels (HTML-fixed-size ผ่าน Konva Text สุดยอดยุ่ง — ใช้ HTML overlay ด้านล่างแทน) */}
      </Stage>

      {/* HTML overlay: scale draft label */}
      {previewLabelPos && (
        <div
          style={{
            position: 'absolute',
            left: previewLabelPos.x,
            top: previewLabelPos.y,
            transform: 'translate(8px, -50%)',
            background: 'rgba(20,20,20,0.92)',
            color: COLOR.draft,
            border: `1px solid ${COLOR.draft}`,
            borderRadius: 3,
            padding: '2px 6px',
            fontSize: 11,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {previewLabelText}
        </div>
      )}

      {/* HTML overlay: draft quantity readout (real-time) */}
      {draftPreview && (() => {
        const pts = draftPreview.kind === 'rect'
          ? [
              { x: draftPreview.rect.x, y: draftPreview.rect.y },
              { x: draftPreview.rect.x + draftPreview.rect.width, y: draftPreview.rect.y + draftPreview.rect.height },
            ]
          : draftPreview.points;
        const last = pts[pts.length - 1]!;
        const screen = pageToScreen(last, t);
        const q = draftPreview.quantity;
        let txt = '';
        if (draftPreview.kind === 'line' || draftPreview.kind === 'polyline') {
          txt = q != null ? `${q.toFixed(3)} m` : 'ยังไม่ตั้ง scale';
        } else {
          txt = q != null ? `${q.toFixed(3)} m²` : 'ยังไม่ตั้ง scale';
        }
        return (
          <div
            style={{
              position: 'absolute',
              left: screen.x,
              top: screen.y,
              transform: 'translate(10px, -50%)',
              background: 'rgba(20,20,20,0.92)',
              color: COLOR.draft,
              border: `1px solid ${COLOR.draft}`,
              borderRadius: 3,
              padding: '2px 6px',
              fontSize: 11,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {txt}
          </div>
        );
      })()}

      {/* HTML overlay: confirmed measurement labels */}
      {measurementsForPage.map((m) => {
        if (m.geometry.kind === 'point') return null; // label อยู่ใต้ marker
        const pts = geometryPoints(m.geometry);
        const bbox = bboxOf(pts);
        if (!bbox) return null;
        const center = { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
        const screen = pageToScreen(center, t);
        const isSelected = selectedSet.has(m.id) || boqHighlightSets.strong.has(m.id);
        const qTxt =
          m.metadata && (m.metadata as Record<string, unknown>).noScale
            ? '— (ยังไม่ตั้ง scale)'
            : `${m.quantity.toFixed(3)} ${m.unit === 'm2' ? 'm²' : m.unit}`;
        return (
          <div
            key={m.id}
            style={{
              position: 'absolute',
              left: screen.x,
              top: screen.y,
              transform: 'translate(-50%, -50%)',
              background: 'rgba(20,20,20,0.85)',
              color: isSelected ? COLOR.selected : COLOR.confirmed,
              border: `1px solid ${isSelected ? COLOR.selected : COLOR.confirmed}`,
              borderRadius: 3,
              padding: '1px 5px',
              fontSize: 10,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {m.label ? `${m.label} · ${qTxt}` : qTxt}
          </div>
        );
      })}

      {/* hint per tool */}
      <ToolHint tool={tool} hasScale={!!scaleProfile} scaleDraftPhase={scaleDraft.phase} draftPhase={draft.phase} draftKind={draft.phase === 'drawing' ? draft.kind : null} />
    </div>
  );
}

/** wrapper ที่ทำให้ react-konva accept array of children โดยไม่ต้องห่อใน Group ใหม่ */
function ShapeGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function CountMarker({
  cx,
  cy,
  color,
  zoom,
  label,
}: {
  cx: number;
  cy: number;
  color: string;
  zoom: number;
  label: string;
}) {
  const r = 7 / zoom;
  const fontSize = 11 / zoom;
  return (
    <>
      <Circle x={cx} y={cy} radius={r} fill={color} opacity={0.85} stroke="#111" strokeWidth={1 / zoom} />
      <Text
        x={cx - r}
        y={cy - fontSize / 2}
        width={r * 2}
        height={fontSize}
        text={label}
        fontSize={fontSize}
        fill="#111"
        align="center"
        verticalAlign="middle"
      />
    </>
  );
}

function ToolHint({
  tool,
  hasScale,
  scaleDraftPhase,
  draftPhase,
  draftKind,
}: {
  tool: string;
  hasScale: boolean;
  scaleDraftPhase: string;
  draftPhase: string;
  draftKind: 'line' | 'polyline' | 'polygon' | 'rect' | null;
}) {
  let msg: string | null = null;
  if (tool === 'scale') {
    msg =
      scaleDraftPhase === 'idle'
        ? hasScale
          ? 'Scale Tool — คลิก 2 จุด เพื่อตรวจสอบ scale (มี scale แล้ว)'
          : 'Scale Tool — คลิกจุดแรกบนระยะที่รู้ค่าจริง'
        : 'คลิกจุดที่สอง — Esc เพื่อยกเลิก';
  } else if (tool === 'line') {
    msg = !hasScale
      ? '⚠ ยังไม่ตั้ง scale — วัดได้แต่ quantity จะเป็น "—"'
      : draftPhase === 'idle' || draftKind !== 'line'
        ? 'Line Tool — คลิกจุดแรก'
        : 'คลิกจุดที่สอง (Esc ยกเลิก)';
  } else if (tool === 'polyline') {
    msg = !hasScale
      ? '⚠ ยังไม่ตั้ง scale — วัดได้แต่ quantity จะเป็น "—"'
      : draftPhase === 'idle' || draftKind !== 'polyline'
        ? 'Polyline — คลิกหลายจุด, Enter/dblclick จบ, Backspace ลบจุดล่าสุด'
        : 'คลิกจุดถัดไป — Enter หรือ dblclick เพื่อจบ — Esc ยกเลิก';
  } else if (tool === 'area') {
    msg = !hasScale
      ? '⚠ ยังไม่ตั้ง scale — วัดได้แต่ quantity จะเป็น "—"'
      : draftPhase === 'idle' || draftKind !== 'polygon'
        ? 'Area Tool — คลิกหลายจุด, Enter/dblclick เพื่อปิด polygon'
        : 'คลิกจุดถัดไป — Enter/dblclick เพื่อปิด — Esc ยกเลิก';
  } else if (tool === 'rect') {
    msg = !hasScale
      ? '⚠ ยังไม่ตั้ง scale — วัดได้แต่ quantity จะเป็น "—"'
      : 'Rectangle — ลากจากมุมหนึ่งไปอีกมุม';
  } else if (tool === 'count') {
    msg = 'Count Tool — คลิกวาง marker (เลือกหมวดจาก toolbar)';
  } else if (tool === 'select') {
    msg = 'Select — คลิกเลือก, ลาก node เพื่อย้าย, Del เพื่อลบ, Shift+คลิก add';
  }
  if (!msg) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        top: 12,
        background: 'rgba(20,20,20,0.92)',
        color: msg.startsWith('⚠') ? '#e6b450' : COLOR.draft,
        border: '1px solid #555',
        borderRadius: 3,
        padding: '4px 8px',
        fontSize: 11,
        pointerEvents: 'none',
        maxWidth: 360,
      }}
    >
      {msg}
    </div>
  );
}

/** ตรวจว่า tool ปัจจุบันยังตรงกับ draft.kind อยู่ไหม (เปลี่ยน tool → cancel draft) */
function toolMatchesDraft(tool: string, kind: 'line' | 'polyline' | 'polygon' | 'rect') {
  if (tool === 'line' && kind === 'line') return true;
  if (tool === 'polyline' && kind === 'polyline') return true;
  if (tool === 'area' && kind === 'polygon') return true;
  if (tool === 'rect' && kind === 'rect') return true;
  return false;
}

