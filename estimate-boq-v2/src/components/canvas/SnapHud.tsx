/**
 * Snap indicator HUD — ดีไซน์เดียวกันทุก type: วงกลม + กากบาท + label
 * - วงกลมรอบจุด snap (ring) + กากบาทกลางจุด (crosshair) + จุดกลาง
 * - faint ring แสดง "รัศมีจับ" ที่ปรับตาม zoom (คงที่ใน screen px)
 * - label เป็น pill อ่านง่ายบนพื้นแบบ
 * สีต่างกันตาม snap type
 */
import { Layer, Circle, Line, Label, Tag, Text, Group } from 'react-konva';
import type { SnapPoint } from '@/core/snap';
import type { ViewTransform } from '@/types/viewport';

const COLORS: Record<SnapPoint['type'], string> = {
  endpoint: '#22c55e',
  midpoint: '#eab308',
  intersection: '#ec4899',
  perpendicular: '#06b6d4',
  onEdge: '#f97316',
  grid: '#94a3b8',
  image: '#22d3ee',
};

const LABELS: Record<SnapPoint['type'], string> = {
  endpoint: 'ปลายเส้น',
  midpoint: 'กึ่งกลาง',
  intersection: 'จุดตัด',
  perpendicular: 'ตั้งฉาก',
  onEdge: 'บนเส้น',
  grid: 'กริด',
  image: 'เส้นในแบบ',
};

interface Props {
  snap: SnapPoint | null;
  transform: ViewTransform;
  /** รัศมีจับ snap (screen px) — วาด faint ring ให้เห็นว่าปรับตาม zoom */
  catchRadius?: number;
}

export function SnapHud({ snap, transform, catchRadius }: Props) {
  return (
    <Layer listening={false}>
      {snap && (
        <SnapMarker snap={snap} transform={transform} catchRadius={catchRadius} />
      )}
    </Layer>
  );
}

function SnapMarker({
  snap,
  transform,
  catchRadius,
}: {
  snap: SnapPoint;
  transform: ViewTransform;
  catchRadius?: number;
}) {
  const sx = snap.x * transform.zoom + transform.panX;
  const sy = snap.y * transform.zoom + transform.panY;
  const color = COLORS[snap.type];
  const label = LABELS[snap.type];

  const RING = 8; // รัศมีวงกลม indicator (screen px)
  const ARM_OUT = 12; // ปลายแขนกากบาท
  const ARM_IN = 4; // เว้นช่องตรงกลางกากบาท

  return (
    <Group listening={false}>
      {/* รัศมีจับ snap (จาง) — ปรับตาม zoom */}
      {catchRadius && catchRadius > RING + 2 && (
        <Circle
          x={sx}
          y={sy}
          radius={catchRadius}
          stroke={color}
          strokeWidth={1}
          opacity={0.18}
          dash={[3, 4]}
        />
      )}

      {/* วงกลม indicator */}
      <Circle
        x={sx}
        y={sy}
        radius={RING}
        stroke={color}
        strokeWidth={2}
        shadowColor="#0b1220"
        shadowBlur={3}
        shadowOpacity={0.7}
      />

      {/* กากบาท (crosshair) ทะลุกลางจุด */}
      <Line points={[sx - ARM_OUT, sy, sx - ARM_IN, sy]} stroke={color} strokeWidth={1.5} />
      <Line points={[sx + ARM_IN, sy, sx + ARM_OUT, sy]} stroke={color} strokeWidth={1.5} />
      <Line points={[sx, sy - ARM_OUT, sx, sy - ARM_IN]} stroke={color} strokeWidth={1.5} />
      <Line points={[sx, sy + ARM_IN, sx, sy + ARM_OUT]} stroke={color} strokeWidth={1.5} />

      {/* จุดกลาง */}
      <Circle x={sx} y={sy} radius={1.8} fill={color} />

      {/* label pill */}
      <Label x={sx + ARM_OUT + 4} y={sy - 9}>
        <Tag fill="#0b1220" opacity={0.82} cornerRadius={3} />
        <Text
          text={label}
          fontFamily="Sarabun"
          fontSize={11}
          fontStyle="600"
          fill={color}
          padding={4}
        />
      </Label>
    </Group>
  );
}
