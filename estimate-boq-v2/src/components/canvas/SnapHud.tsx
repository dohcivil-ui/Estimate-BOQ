/**
 * Snap indicator HUD — โชว์ glyph ที่จุด snap พร้อม label
 * glyph ต่างกันตาม snap type (ตามดีไซน์ใน cost-estimator-v2.html)
 */
import { Layer, Circle, RegularPolygon, Star, Text, Line, Group } from 'react-konva';
import type { SnapPoint } from '@/core/snap';
import type { ViewTransform } from '@/types/viewport';

const COLORS: Record<SnapPoint['type'], string> = {
  endpoint: '#22c55e',
  midpoint: '#eab308',
  intersection: '#ec4899',
  perpendicular: '#06b6d4',
  onEdge: '#f97316',
  image: '#22d3ee',
};

const LABELS: Record<SnapPoint['type'], string> = {
  endpoint: '● ปลายเส้น',
  midpoint: '▲ กึ่งกลาง',
  intersection: '✕ จุดตัด',
  perpendicular: '⊾ ตั้งฉาก',
  onEdge: '◇ บนเส้น',
  image: '✛ เส้นในแบบ',
};

interface Props {
  snap: SnapPoint | null;
  transform: ViewTransform;
}

export function SnapHud({ snap, transform }: Props) {
  return (
    <Layer listening={false}>
      {snap && <SnapMarker snap={snap} transform={transform} />}
    </Layer>
  );
}

function SnapMarker({
  snap,
  transform,
}: {
  snap: SnapPoint;
  transform: ViewTransform;
}) {
  const sx = snap.x * transform.zoom + transform.panX;
  const sy = snap.y * transform.zoom + transform.panY;
  const color = COLORS[snap.type];
  const label = LABELS[snap.type];

  return (
    <Group>
      {snap.type === 'endpoint' && (
        <Circle x={sx} y={sy} radius={6} fill={color} stroke="#0b1220" strokeWidth={1.5} />
      )}
      {snap.type === 'midpoint' && (
        <RegularPolygon
          x={sx}
          y={sy}
          sides={3}
          radius={7}
          fill={color}
          stroke="#0b1220"
          strokeWidth={1.5}
        />
      )}
      {snap.type === 'intersection' && (
        <Star
          x={sx}
          y={sy}
          numPoints={4}
          innerRadius={2}
          outerRadius={7}
          fill={color}
          rotation={45}
        />
      )}
      {snap.type === 'perpendicular' && (
        <Group x={sx - 6} y={sy - 6}>
          <Line points={[0, 0, 0, 12]} stroke={color} strokeWidth={2} />
          <Line points={[0, 12, 12, 12]} stroke={color} strokeWidth={2} />
        </Group>
      )}
      {snap.type === 'onEdge' && (
        <RegularPolygon
          x={sx}
          y={sy}
          sides={4}
          radius={6}
          fill={color}
          stroke="#0b1220"
          strokeWidth={1.5}
          rotation={45}
        />
      )}
      {snap.type === 'image' && (
        <Group x={sx} y={sy}>
          <Line points={[-7, 0, 7, 0]} stroke={color} strokeWidth={2} />
          <Line points={[0, -7, 0, 7]} stroke={color} strokeWidth={2} />
        </Group>
      )}
      <Text
        x={sx + 10}
        y={sy + 6}
        text={label}
        fontFamily="Sarabun"
        fontSize={11}
        fontStyle="600"
        fill={color}
        shadowColor="#0b1220"
        shadowBlur={4}
        shadowOpacity={0.8}
      />
    </Group>
  );
}
