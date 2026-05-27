/**
 * แสดง measurement ที่ confirmed บน canvas
 * - Length (polyline): เส้นสีฟ้า + label ที่จุดกลาง
 * - Area (polygon): เส้นสีฟ้า + fill โปร่ง + label ตรงกลาง
 * - Count: จุด/marker + เลขลำดับ
 * - Scale: เส้นสีเหลือง + ระยะจริง
 * Selected → highlight สีส้ม
 */
import { useMemo } from 'react';
import { Layer, Line, Circle, Text, Group } from 'react-konva';
import type { Measurement } from '@/types/measurement';
import type { ViewTransform } from '@/types/viewport';
import { useMeasurementStore } from '@/stores/measurementStore';
import { CANVAS_COLORS } from './canvasTheme';

interface Props {
  measurements: Measurement[];
  transform: ViewTransform;
}

const COLOR_LENGTH = CANVAS_COLORS.length; // ม่วง
const COLOR_AREA = CANVAS_COLORS.area; // ฟ้า
const COLOR_SCALE = CANVAS_COLORS.scale; // ทอง
const COLOR_SELECTED = CANVAS_COLORS.selected; // ส้ม
const COLOR_COUNT = CANVAS_COLORS.count; // เขียว
const FILL_AREA = CANVAS_COLORS.areaFill;

export function MeasurementsLayer({ measurements, transform }: Props) {
  const selectedId = useMeasurementStore((s) => s.selectedId);
  const select = useMeasurementStore((s) => s.select);

  return (
    <Layer>
      {measurements.map((m) => (
        <MeasurementShape
          key={m.id}
          m={m}
          transform={transform}
          selected={m.id === selectedId}
          onSelect={() => select(m.id)}
        />
      ))}
    </Layer>
  );
}

function MeasurementShape({
  m,
  transform,
  selected,
  onSelect,
}: {
  m: Measurement;
  transform: ViewTransform;
  selected: boolean;
  onSelect: () => void;
}) {
  const screenPts = useMemo(
    () =>
      m.points.flatMap((p) => [
        p.x * transform.zoom + transform.panX,
        p.y * transform.zoom + transform.panY,
      ]),
    [m.points, transform],
  );

  const labelPos = useMemo(() => labelPosition(m, transform), [m, transform]);

  // ─── Count: render markers ────────────────────────────────────────────
  if (m.type === 'count') {
    return (
      <Group onClick={onSelect} onTap={onSelect}>
        {m.points.map((p, idx) => {
          const x = p.x * transform.zoom + transform.panX;
          const y = p.y * transform.zoom + transform.panY;
          return (
            <Group key={idx}>
              <Circle
                x={x}
                y={y}
                radius={6}
                fill={selected ? COLOR_SELECTED : COLOR_COUNT}
                stroke="#0b1220"
                strokeWidth={1.5}
              />
              <Text
                x={x + 8}
                y={y - 6}
                text={String(idx + 1)}
                fontFamily="Sarabun"
                fontSize={11}
                fill={selected ? COLOR_SELECTED : COLOR_COUNT}
              />
            </Group>
          );
        })}
        {m.label && labelPos && (
          <ShapeLabel x={labelPos.x} y={labelPos.y} text={m.label} selected={selected} />
        )}
      </Group>
    );
  }

  // ─── Scale: เส้น + ระยะจริง ──────────────────────────────────────────
  if (m.type === 'scale') {
    return (
      <Group onClick={onSelect} onTap={onSelect}>
        <Line
          points={screenPts}
          stroke={selected ? COLOR_SELECTED : COLOR_SCALE}
          strokeWidth={2}
          dash={[6, 4]}
        />
        {m.points.map((p, idx) => (
          <Circle
            key={idx}
            x={p.x * transform.zoom + transform.panX}
            y={p.y * transform.zoom + transform.panY}
            radius={4}
            fill={selected ? COLOR_SELECTED : COLOR_SCALE}
          />
        ))}
        {labelPos && (
          <ShapeLabel
            x={labelPos.x}
            y={labelPos.y}
            text={m.label}
            selected={selected}
          />
        )}
      </Group>
    );
  }

  // ─── Length / Area ────────────────────────────────────────────────────
  const isArea = m.type === 'area';
  const baseColor = isArea ? COLOR_AREA : COLOR_LENGTH;
  return (
    <Group onClick={onSelect} onTap={onSelect}>
      <Line
        points={screenPts}
        stroke={selected ? COLOR_SELECTED : baseColor}
        strokeWidth={2}
        closed={isArea}
        fill={isArea ? FILL_AREA : undefined}
        listening
      />
      {m.points.map((p, idx) => (
        <Circle
          key={idx}
          x={p.x * transform.zoom + transform.panX}
          y={p.y * transform.zoom + transform.panY}
          radius={3.5}
          fill={selected ? COLOR_SELECTED : baseColor}
          stroke="#0b1220"
          strokeWidth={1}
        />
      ))}
      {labelPos && (
        <ShapeLabel
          x={labelPos.x}
          y={labelPos.y}
          text={m.label}
          selected={selected}
        />
      )}
    </Group>
  );
}

function ShapeLabel({
  x,
  y,
  text,
  selected,
}: {
  x: number;
  y: number;
  text: string;
  selected: boolean;
}) {
  return (
    <Text
      x={x}
      y={y}
      text={text}
      fontFamily="Sarabun"
      fontSize={12}
      fontStyle="600"
      fill={selected ? COLOR_SELECTED : '#e2e8f0'}
      shadowColor="#0b1220"
      shadowBlur={4}
      shadowOpacity={0.8}
      listening={false}
    />
  );
}

/** หา position สำหรับ label (กึ่งกลาง bounding box) */
function labelPosition(
  m: Measurement,
  t: ViewTransform,
): { x: number; y: number } | null {
  if (m.points.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const p of m.points) {
    sx += p.x;
    sy += p.y;
  }
  sx /= m.points.length;
  sy /= m.points.length;
  return {
    x: sx * t.zoom + t.panX + 6,
    y: sy * t.zoom + t.panY + 6,
  };
}
