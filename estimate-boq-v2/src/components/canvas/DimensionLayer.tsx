/**
 * DimensionLayer — overlay เส้นบอกระยะที่ผู้ใช้วาด (R1-C8b)
 * - วาด: เส้น commit แล้ว = Arrow สองหัว + label กลางเส้น · preview จุดเริ่ม→cursor (ประ) + node จุดเริ่ม
 * - label: valueM != null ? "x.xx ม." : "?"  (C8b ทุกเส้น = "?" รอ C8c กรอกค่า)
 * - page-px → screen สูตรเดียวกับ FootingGridLayer · listening={false} ทั้ง layer
 * - ⚠️ slot ตายตัวใน CanvasArea (FootingGrid → ที่นี่ → Draft) ห้าม moveToTop
 */
import { Fragment } from 'react';
import { Layer, Line, Circle, Arrow, Label, Text } from 'react-konva';
import type { Point2D, ViewTransform } from '@/types/viewport';
import type { DimLine } from '@/types/tool';
import { CANVAS_COLORS } from './canvasTheme';

interface Props {
  dimensions: DimLine[];
  pendingStart: Point2D | null;
  cursorPoint: Point2D | null;
  transform: ViewTransform;
  selectedIndex: number | null;
}

const COLOR = CANVAS_COLORS.dimension; // ฟ้า #38bdf8
const COLOR_SEL = CANVAS_COLORS.selected; // ส้ม — เส้นที่เลือก

export function DimensionLayer({ dimensions, pendingStart, cursorPoint, transform, selectedIndex }: Props) {
  // ไม่มีอะไรต้องวาด → layer ว่าง (ยังคง mount ที่ slot เดิม)
  if (dimensions.length === 0 && !pendingStart) return <Layer listening={false} />;

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
      {dimensions.map((d, i) => {
        const [ax, ay] = toScreen(d.a);
        const [bx, by] = toScreen(d.b);
        const sel = i === selectedIndex;
        const color = sel ? COLOR_SEL : COLOR;
        const label = d.valueM != null ? `${d.valueM.toFixed(2)} ม.` : '?';
        return (
          <Fragment key={i}>
            <Arrow
              points={[ax, ay, bx, by]}
              stroke={color}
              fill={color}
              strokeWidth={sel ? 3 : 1.5}
              pointerLength={8}
              pointerWidth={7}
              pointerAtBeginning
            />
            <DimLabel ax={ax} ay={ay} bx={bx} by={by} text={label} color={color} />
          </Fragment>
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

function DimLabel({ ax, ay, bx, by, text, color }: {
  ax: number; ay: number; bx: number; by: number; text: string; color: string;
}) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  // มุม text ขนานเส้น normalize [-90,90) → เส้นตั้งอ่านล่าง→บน ไม่กลับหัว
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  deg = ((deg % 180) + 180) % 180;
  if (deg >= 90) deg -= 180;
  // เยื้อง label ตั้งฉากกับเส้น 16px · ฝั่งคงที่: เส้นนอน→ขึ้นบน, เส้นตั้ง→ออกซ้าย (ไม่ขึ้นกับลำดับ a,b)
  let sx = dy / len;
  let sy = -dx / len;
  if (sy > 0 || (sy === 0 && sx > 0)) {
    sx = -sx;
    sy = -sy;
  }
  const GAP = 16;
  const lx = (ax + bx) / 2 + sx * GAP;
  const ly = (ay + by) / 2 + sy * GAP;
  return (
    <Label x={lx} y={ly} rotation={deg} offsetX={text.length * 3} offsetY={6}>
      <Text text={text} fontFamily="Sarabun" fontSize={12} fontStyle="600" fill={color} />
    </Label>
  );
}
