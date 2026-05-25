/**
 * Draft preview — เส้นประขณะวาด (เหลืองตาม spec §8.1 ของ Track A)
 * + เส้นจาก lastPoint → cursor (ผ่าน snap/ortho แล้ว)
 */
import { Layer, Line, Circle } from 'react-konva';
import type { Point2D, ViewTransform } from '@/types/viewport';
import type { Tool } from '@/types/tool';

const COLOR_DRAFT = '#facc15'; // yellow-400
const COLOR_RUBBER = '#facc15';

interface Props {
  tool: Tool;
  draftPoints: Point2D[];
  cursorPoint: Point2D | null;
  transform: ViewTransform;
}

export function DraftLayer({ tool, draftPoints, cursorPoint, transform }: Props) {
  if (draftPoints.length === 0) return <Layer listening={false} />;

  const toScreen = (p: Point2D): [number, number] => [
    p.x * transform.zoom + transform.panX,
    p.y * transform.zoom + transform.panY,
  ];

  const fixedScreenPts = draftPoints.flatMap(toScreen);
  const lastScreen = toScreen(draftPoints[draftPoints.length - 1]!);
  const rubberLine = cursorPoint
    ? [lastScreen[0], lastScreen[1], ...toScreen(cursorPoint)]
    : null;

  const isArea = tool === 'area';
  // สำหรับ area แสดง closing segment จาก cursor กลับจุดแรกด้วย (ถ้ามี cursor และ ≥2 จุด)
  const closingLine =
    isArea && cursorPoint && draftPoints.length >= 2
      ? [...toScreen(cursorPoint), ...toScreen(draftPoints[0]!)]
      : null;

  return (
    <Layer listening={false}>
      {/* ส่วนที่วางแล้ว = เส้นทึบเหลือง */}
      <Line points={fixedScreenPts} stroke={COLOR_DRAFT} strokeWidth={2} />
      {/* rubber-band ไปยัง cursor = เส้นประ */}
      {rubberLine && (
        <Line
          points={rubberLine}
          stroke={COLOR_RUBBER}
          strokeWidth={1.5}
          dash={[5, 4]}
        />
      )}
      {/* closing edge สำหรับ polygon */}
      {closingLine && (
        <Line
          points={closingLine}
          stroke={COLOR_RUBBER}
          strokeWidth={1.5}
          dash={[5, 4]}
          opacity={0.5}
        />
      )}
      {/* nodes */}
      {draftPoints.map((p, idx) => {
        const [sx, sy] = toScreen(p);
        return (
          <Circle
            key={idx}
            x={sx}
            y={sy}
            radius={4}
            fill={COLOR_DRAFT}
            stroke="#0b1220"
            strokeWidth={1.5}
          />
        );
      })}
    </Layer>
  );
}
