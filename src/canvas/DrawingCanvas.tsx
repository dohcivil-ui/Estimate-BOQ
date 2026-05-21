// src/canvas/DrawingCanvas.tsx — Konva viewer (spec §3.1, §5, §9.2)
// background raster layer + overlay layer; zoom-at-mouse / pan / fit + Scale Tool preview
import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle } from 'react-konva';
import type Konva from 'konva';
import { pageToScreen, screenToPage } from '../core/coords';
import { distancePx } from '../core/geometry';
import { useDrawingStore } from '../stores/drawingStore';
import { useViewportStore } from '../stores/viewportStore';
import { useToolStore } from '../stores/toolStore';
import { useCursorStore } from '../stores/cursorStore';
import { useScaleStore } from '../stores/scaleStore';
import type { PagePoint } from '../types';

type Props = { width: number; height: number };

const ZOOM_STEP = 1.1;
const CLICK_THRESHOLD_PX = 4; // spec §7.2 click<4px, drag≥4px

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

  const stageRef = useRef<Konva.Stage | null>(null);
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const mouseDownAtRef = useRef<{ x: number; y: number } | null>(null);
  const spaceDownRef = useRef(false);
  const [cursorPage, setCursorPage] = useState<PagePoint | null>(null);

  // auto-fit เมื่อเปลี่ยนหน้า/ขนาด container ครั้งแรก (ไม่ override transform เดิม)
  // ใช้ canonical pageWidth/pageHeight — ขนาด space ที่ geometry อ้างถึง
  useEffect(() => {
    if (!page) return;
    if (transform) return;
    fit(page.id, width, height, page.pageWidth, page.pageHeight);
  }, [page, transform, width, height, fit]);

  // space-bar = pan ชั่วคราว (spec §6.1)
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = true;
      if (e.code === 'Escape' && scaleDraft.phase !== 'idle') cancelScaleDraft();
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
  }, [scaleDraft.phase, cancelScaleDraft]);

  // เปลี่ยน tool ออกจาก scale → ล้าง draft กันค้าง
  useEffect(() => {
    if (tool !== 'scale' && scaleDraft.phase !== 'idle') cancelScaleDraft();
  }, [tool, scaleDraft.phase, cancelScaleDraft]);

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

  const t = transform ?? { zoom: 1, panX: 0, panY: 0, rotationDeg: 0 as const };

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
    if (wantsPanDrag(e)) {
      e.evt.preventDefault();
      isPanningRef.current = true;
      lastPointerRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      mouseDownAtRef.current = null;
      return;
    }
    // เก็บ position เพื่อแยก click กับ drag ใน handleMouseUp
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
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      lastPointerRef.current = null;
      return;
    }
    const down = mouseDownAtRef.current;
    mouseDownAtRef.current = null;
    if (!down) return;
    const moved = Math.hypot(e.evt.clientX - down.x, e.evt.clientY - down.y);
    if (moved >= CLICK_THRESHOLD_PX) return; // drag, ไม่นับเป็น click
    onCanvasClick();
  };

  const handleMouseLeave = () => {
    isPanningRef.current = false;
    lastPointerRef.current = null;
    mouseDownAtRef.current = null;
    setCursor(null);
    setCursorPage(null);
  };

  function onCanvasClick() {
    if (!cursorPage) return;
    if (tool === 'scale') {
      if (scaleDraft.phase === 'idle') {
        startScaleDraft(page!.id, cursorPage);
      } else if (
        scaleDraft.phase === 'awaitingP2' &&
        scaleDraft.pageId === page!.id
      ) {
        commitScaleP2(cursorPage);
      }
    }
  }

  // ---- preview values for scale tool ----
  const scaleP1 =
    scaleDraft.phase === 'awaitingP2' && scaleDraft.pageId === page.id
      ? scaleDraft.p1
      : null;
  const previewP2 = scaleP1 && cursorPage ? cursorPage : null;
  const previewPixelDistance = useMemo(() => {
    if (!scaleP1 || !previewP2) return null;
    return distancePx(scaleP1, previewP2);
  }, [scaleP1, previewP2]);

  // HTML overlay label position (fixed size, on top of Konva)
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

  // เส้น reference ของ scale ที่ตั้งไว้แล้ว — โชว์จางๆ
  const refP1 = scaleProfile?.p1 ?? null;
  const refP2 = scaleProfile?.p2 ?? null;

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
        style={{
          background: '#262626',
          cursor:
            tool === 'pan' || spaceDownRef.current
              ? 'grab'
              : tool === 'scale'
                ? 'crosshair'
                : 'default',
        }}
      >
        <Layer listening={false}>
          {page.bitmap && (
            // Konva Image ตั้ง width/height จาก canonical (ไม่ใช้ natural ของ bitmap)
            // เพื่อให้อนาคต re-render bitmap คมขึ้นแล้ว geometry ที่เก็บไว้ไม่ขยับ
            <KonvaImage
              image={page.bitmap}
              x={0}
              y={0}
              width={page.pageWidth}
              height={page.pageHeight}
            />
          )}
        </Layer>
        {/* overlay: scale reference + scale draft preview (measurements จะมาเติม Phase 3) */}
        <Layer listening={false}>
          {refP1 && refP2 && (
            <>
              <Line
                points={[refP1.x, refP1.y, refP2.x, refP2.y]}
                stroke="#5b9dff"
                strokeWidth={1 / t.zoom}
                opacity={0.55}
                dash={[6 / t.zoom, 4 / t.zoom]}
              />
              <Circle x={refP1.x} y={refP1.y} radius={3 / t.zoom} fill="#5b9dff" opacity={0.7} />
              <Circle x={refP2.x} y={refP2.y} radius={3 / t.zoom} fill="#5b9dff" opacity={0.7} />
            </>
          )}
          {scaleP1 && previewP2 && (
            <>
              <Line
                points={[scaleP1.x, scaleP1.y, previewP2.x, previewP2.y]}
                stroke="#ffd44d"
                strokeWidth={1.5 / t.zoom}
                dash={[8 / t.zoom, 4 / t.zoom]}
              />
              <Circle x={scaleP1.x} y={scaleP1.y} radius={4 / t.zoom} fill="#ffd44d" />
              <Circle x={previewP2.x} y={previewP2.y} radius={4 / t.zoom} fill="#ffd44d" opacity={0.8} />
            </>
          )}
        </Layer>
      </Stage>
      {/* HTML label สำหรับ pixel-distance ของ draft (ไม่ scale ตาม zoom) */}
      {previewLabelPos && (
        <div
          style={{
            position: 'absolute',
            left: previewLabelPos.x,
            top: previewLabelPos.y,
            transform: 'translate(8px, -50%)',
            background: 'rgba(20,20,20,0.92)',
            color: '#ffd44d',
            border: '1px solid #ffd44d',
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
      {/* hint */}
      {tool === 'scale' && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            background: 'rgba(20,20,20,0.92)',
            color: '#ffd44d',
            border: '1px solid #555',
            borderRadius: 3,
            padding: '4px 8px',
            fontSize: 11,
            pointerEvents: 'none',
          }}
        >
          {scaleDraft.phase === 'idle'
            ? scaleProfile
              ? 'Scale Tool — คลิก 2 จุด เพื่อตรวจสอบ scale (มี scale แล้ว)'
              : 'Scale Tool — คลิกจุดแรกบนระยะที่รู้ค่าจริง'
            : 'คลิกจุดที่สอง — Esc เพื่อยกเลิก'}
        </div>
      )}
    </div>
  );
}
