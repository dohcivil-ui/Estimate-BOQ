/**
 * FootingGridLayer — overlay เส้นกริดที่ผู้ใช้วาด (inc2 thin slice)
 * - วาด: เส้น commit แล้ว (ทึบ) + เส้น preview จุดเริ่ม→cursor (ประ) + node จุดเริ่ม
 * - page-px → screen สูตรเดียวกับ DraftLayer · listening={false} ทั้ง layer
 * - ⚠️ ห้าม moveToTop — slot ตายตัวใน CanvasArea (Detection → ที่นี่ → Draft)
 */
import { Layer, Line, Circle } from 'react-konva';
import type { Point2D, ViewTransform } from '@/types/viewport';
import type { GridLine } from '@/types/tool';
import { CANVAS_COLORS } from './canvasTheme';

interface Props {
  gridLines: GridLine[];
  pendingStart: Point2D | null;
  cursorPoint: Point2D | null;
  transform: ViewTransform;
  selectedIndex: number | null;
}

const COLOR = CANVAS_COLORS.grid; // ทอง #c9a227
const COLOR_SEL = CANVAS_COLORS.selected; // ส้ม #f97316 — เส้นที่เลือก

export function FootingGridLayer({ gridLines, pendingStart, cursorPoint, transform, selectedIndex }: Props) {
  // ไม่มีอะไรต้องวาด → layer ว่าง (ยังคง mount ที่ slot เดิม)
  if (gridLines.length === 0 && !pendingStart) return <Layer listening={false} />;

  const toScreen = (p: Point2D): [number, number] => [
    p.x * transform.zoom + transform.panX,
    p.y * transform.zoom + transform.panY,
  ];

  const preview =
    pendingStart && cursorPoint
      ? [...toScreen(pendingStart), ...toScreen(cursorPoint)]
      : null;
  const startScreen = pendingStart ? toScreen(pendingStart) : null;

  return (
    <Layer listening={false}>
      {gridLines.map((ln, i) => {
        const [ax, ay] = toScreen(ln.a);
        const [bx, by] = toScreen(ln.b);
        const sel = i === selectedIndex;
        return (
          <Line
            key={i}
            points={[ax, ay, bx, by]}
            stroke={sel ? COLOR_SEL : COLOR}
            strokeWidth={sel ? 3 : 1.5}
          />
        );
      })}
      {preview && <Line points={preview} stroke={COLOR} strokeWidth={1.5} dash={[6, 4]} />}
      {startScreen && (
        <Circle x={startScreen[0]} y={startScreen[1]} radius={4} fill={COLOR}
          stroke={CANVAS_COLORS.outline} strokeWidth={1.5} />
      )}
    </Layer>
  );
}
