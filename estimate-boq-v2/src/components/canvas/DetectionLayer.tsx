/**
 * DetectionLayer — วาดกล่องที่ AI (Perceptron) ตรวจพบ บน canvas
 * - สีตามชนิดฐาน (F2 cyan / F1 amber / อื่น ๆ violet)
 * - คลิก → เลือก + เรืองแสง (glow), label ชนิดเหนือกล่อง
 * พิกัด box เป็น page coords → แปลงเป็น screen ด้วย transform เดิม (เหมือน DraftLayer)
 */
import { Layer, Rect, Text, Group } from 'react-konva';
import type { ViewTransform } from '@/types/viewport';
import { useDetectionStore } from '@/stores/detectionStore';
import type { DetectedBox } from '@/services/boxDetect';

const TYPE_COLORS: Record<string, string> = {
  F2: '#34d3ee',
  F1: '#ffb43a',
  C2: '#34d3ee',
  C3: '#ffb43a',
};
const DEFAULT_COLOR = '#a78bfa';
const SELECTED_COLOR = '#39e58c';

interface Props {
  transform: ViewTransform;
}

export function DetectionLayer({ transform }: Props) {
  const boxes = useDetectionStore((s) => s.boxes);
  const selectedId = useDetectionStore((s) => s.selectedId);
  const select = useDetectionStore((s) => s.select);

  return (
    <Layer>
      {transform &&
        boxes.map((b) => (
          <BoxShape
            key={b.id}
            box={b}
            transform={transform}
            selected={b.id === selectedId}
            onSelect={() => select(b.id)}
          />
        ))}
    </Layer>
  );
}

function BoxShape({
  box,
  transform,
  selected,
  onSelect,
}: {
  box: DetectedBox;
  transform: ViewTransform;
  selected: boolean;
  onSelect: () => void;
}) {
  const x = box.x * transform.zoom + transform.panX;
  const y = box.y * transform.zoom + transform.panY;
  const w = box.w * transform.zoom;
  const h = box.h * transform.zoom;
  const color = selected
    ? SELECTED_COLOR
    : (TYPE_COLORS[box.type] ?? DEFAULT_COLOR);

  return (
    <Group onClick={onSelect} onTap={onSelect}>
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        stroke={color}
        strokeWidth={selected ? 3 : 2}
        cornerRadius={3}
        fill={`${color}${selected ? '26' : '14'}`}
        shadowColor={color}
        shadowBlur={selected ? 16 : 0}
        shadowOpacity={selected ? 0.9 : 0}
      />
      <Text
        x={x}
        y={y - 16}
        text={box.type}
        fontFamily="Sarabun"
        fontSize={12}
        fontStyle="700"
        fill={color}
        shadowColor="#0b1220"
        shadowBlur={4}
        shadowOpacity={0.8}
        listening={false}
      />
    </Group>
  );
}
