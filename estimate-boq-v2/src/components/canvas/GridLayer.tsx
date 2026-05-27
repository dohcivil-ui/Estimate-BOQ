/**
 * Grid overlay — เส้นกริดจาง ๆ เมื่อเปิด grid snap
 * วาดเฉพาะช่วงที่มองเห็น (viewport) และข้ามถ้ากริดถี่เกินไป (กันรกตา/perf)
 */
import { useMemo } from 'react';
import { Layer, Line } from 'react-konva';
import type { ViewTransform } from '@/types/viewport';
import { CANVAS_COLORS } from './canvasTheme';

interface Props {
  width: number;
  height: number;
  transform: ViewTransform;
  /** ระยะห่างกริด (page-px) — <=0 หรือ undefined = ไม่วาด */
  spacingPage: number | undefined;
  color?: string;
}

const MIN_SCREEN_STEP = 10; // px — ถี่กว่านี้ไม่วาด
const MAX_LINES = 400; // กันวาดเส้นเยอะเกิน

export function GridLayer({
  width,
  height,
  transform,
  spacingPage,
  color = CANVAS_COLORS.grid,
}: Props) {
  const lines = useMemo(() => {
    if (!spacingPage || spacingPage <= 0 || width <= 0 || height <= 0) return null;
    const screenStep = spacingPage * transform.zoom;
    if (screenStep < MIN_SCREEN_STEP) return null;

    // ช่วง page ที่มองเห็น
    const pxToScreenX = (px: number) => px * transform.zoom + transform.panX;
    const pyToScreenY = (py: number) => py * transform.zoom + transform.panY;
    const startI = Math.floor((0 - transform.panX) / transform.zoom / spacingPage);
    const endI = Math.ceil((width - transform.panX) / transform.zoom / spacingPage);
    const startJ = Math.floor((0 - transform.panY) / transform.zoom / spacingPage);
    const endJ = Math.ceil((height - transform.panY) / transform.zoom / spacingPage);

    if (endI - startI > MAX_LINES || endJ - startJ > MAX_LINES) return null;

    const v: number[][] = [];
    for (let i = startI; i <= endI; i++) {
      const sx = pxToScreenX(i * spacingPage);
      v.push([sx, 0, sx, height]);
    }
    const h: number[][] = [];
    for (let j = startJ; j <= endJ; j++) {
      const sy = pyToScreenY(j * spacingPage);
      h.push([0, sy, width, sy]);
    }
    return { v, h };
  }, [width, height, transform, spacingPage]);

  if (!lines) return <Layer listening={false} />;

  return (
    <Layer listening={false}>
      {lines.v.map((pts, i) => (
        <Line key={`v${i}`} points={pts} stroke={color} strokeWidth={1} opacity={0.1} />
      ))}
      {lines.h.map((pts, i) => (
        <Line key={`h${i}`} points={pts} stroke={color} strokeWidth={1} opacity={0.1} />
      ))}
    </Layer>
  );
}
