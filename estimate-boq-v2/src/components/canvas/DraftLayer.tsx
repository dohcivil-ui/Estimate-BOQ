/**
 * Draft preview — เส้นขณะวาด พร้อม feedback แบบสด
 * - length: dimension line + หัวลูกศรสองหัว + live distance (ช่วงปัจจุบัน + รวม)
 * - area:   polygon + closing edge + ปิดรูปเมื่อ cursor เข้าใกล้จุดแรก + live ตร.ม.
 */
import { Layer, Line, Circle, Arrow, Label, Tag, Text } from 'react-konva';
import type { Point2D, ViewTransform } from '@/types/viewport';
import type { Tool } from '@/types/tool';
import { polylineLengthPx, polygonAreaPx2, distancePx } from '@/core/geometry';
import { CANVAS_COLORS, draftColorFor } from './canvasTheme';

const COLOR_CLOSE = CANVAS_COLORS.close; // เขียว — ปิดรูปได้

interface Props {
  tool: Tool;
  draftPoints: Point2D[];
  cursorPoint: Point2D | null;
  transform: ViewTransform;
  /** เมตร/page-px (จากสเกลของหน้า) — null = ยังไม่ตั้งสเกล แสดงเป็น px */
  unitPerPixel: number | null;
}

export function DraftLayer({
  tool,
  draftPoints,
  cursorPoint,
  transform,
  unitPerPixel,
}: Props) {
  if (draftPoints.length === 0) return <Layer listening={false} />;

  const COLOR_DRAFT = draftColorFor(tool);

  const toScreen = (p: Point2D): [number, number] => [
    p.x * transform.zoom + transform.panX,
    p.y * transform.zoom + transform.panY,
  ];

  const fmtLen = (px: number): string =>
    unitPerPixel ? `${(px * unitPerPixel).toFixed(2)} ม.` : `${px.toFixed(0)} px`;
  const fmtArea = (px2: number): string =>
    unitPerPixel
      ? `${(px2 * unitPerPixel * unitPerPixel).toFixed(2)} ตร.ม.`
      : `${px2.toFixed(0)} px²`;

  const fixedScreenPts = draftPoints.flatMap(toScreen);
  const last = draftPoints[draftPoints.length - 1]!;
  const first = draftPoints[0]!;
  const lastScreen = toScreen(last);

  const isArea = tool === 'area';
  const isLength = tool === 'length';

  // area: cursor ใกล้จุดแรกพอจะปิดรูปไหม (page-px → ปรับตาม zoom)
  const closeThreshold = 12 / transform.zoom;
  const canClose =
    isArea &&
    cursorPoint != null &&
    draftPoints.length >= 3 &&
    distancePx(cursorPoint, first) <= closeThreshold;

  // ─── live distance สำหรับ length ────────────────────────────────────
  let segLabel: { x: number; y: number; text: string } | null = null;
  if (isLength && cursorPoint) {
    const segPx = distancePx(last, cursorPoint);
    const totalPx = polylineLengthPx([...draftPoints, cursorPoint]);
    const cur = toScreen(cursorPoint);
    const mid = { x: (lastScreen[0] + cur[0]) / 2, y: (lastScreen[1] + cur[1]) / 2 };
    const text =
      draftPoints.length >= 2
        ? `${fmtLen(segPx)}   Σ ${fmtLen(totalPx)}`
        : fmtLen(segPx);
    segLabel = { x: mid.x + 8, y: mid.y - 18, text };
  }

  // ─── live area สำหรับ area ──────────────────────────────────────────
  let areaLabel: { x: number; y: number; text: string } | null = null;
  if (isArea && draftPoints.length >= 2) {
    const poly = cursorPoint && !canClose ? [...draftPoints, cursorPoint] : draftPoints;
    if (poly.length >= 3) {
      const areaPx2 = polygonAreaPx2(poly);
      let cx = 0;
      let cy = 0;
      for (const p of poly) {
        cx += p.x;
        cy += p.y;
      }
      cx /= poly.length;
      cy /= poly.length;
      const [sx, sy] = toScreen({ x: cx, y: cy });
      areaLabel = { x: sx, y: sy, text: fmtArea(areaPx2) };
    }
  }

  const rubberLine = cursorPoint
    ? [lastScreen[0], lastScreen[1], ...toScreen(cursorPoint)]
    : null;

  const closingLine =
    isArea && cursorPoint && draftPoints.length >= 2
      ? [...toScreen(cursorPoint), ...toScreen(first)]
      : null;

  return (
    <Layer listening={false}>
      {/* ส่วนที่วางแล้ว = เส้นทึบ */}
      <Line points={fixedScreenPts} stroke={COLOR_DRAFT} strokeWidth={2} />

      {/* rubber-band ไป cursor */}
      {rubberLine &&
        (isLength ? (
          /* dimension line หัวลูกศรสองหัว */
          <Arrow
            points={rubberLine}
            stroke={COLOR_DRAFT}
            fill={COLOR_DRAFT}
            strokeWidth={1.5}
            pointerLength={8}
            pointerWidth={7}
            pointerAtBeginning
          />
        ) : (
          <Line points={rubberLine} stroke={COLOR_DRAFT} strokeWidth={1.5} dash={[5, 4]} />
        ))}

      {/* closing edge สำหรับ polygon */}
      {closingLine && (
        <Line
          points={closingLine}
          stroke={canClose ? COLOR_CLOSE : COLOR_DRAFT}
          strokeWidth={canClose ? 2 : 1.5}
          dash={[5, 4]}
          opacity={canClose ? 0.9 : 0.5}
        />
      )}

      {/* live distance / area */}
      {segLabel && <HudLabel x={segLabel.x} y={segLabel.y} text={segLabel.text} color={COLOR_DRAFT} />}
      {areaLabel && (
        <HudLabel x={areaLabel.x} y={areaLabel.y} text={areaLabel.text} color={COLOR_DRAFT} center />
      )}

      {/* nodes */}
      {draftPoints.map((p, idx) => {
        const [sx, sy] = toScreen(p);
        const isFirst = idx === 0;
        const highlightClose = isFirst && canClose;
        return (
          <Circle
            key={idx}
            x={sx}
            y={sy}
            radius={highlightClose ? 6 : 4}
            fill={highlightClose ? COLOR_CLOSE : COLOR_DRAFT}
            stroke="#0b1220"
            strokeWidth={1.5}
          />
        );
      })}

      {/* ป้าย "ปิดรูป" เมื่อ snap จุดแรก */}
      {canClose && (
        <HudLabel
          x={toScreen(first)[0] + 10}
          y={toScreen(first)[1] - 22}
          text="ปิดรูป ✓"
          color={COLOR_CLOSE}
        />
      )}
    </Layer>
  );
}

function HudLabel({
  x,
  y,
  text,
  color,
  center,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  center?: boolean;
}) {
  return (
    <Label x={x} y={y} offsetX={center ? text.length * 3 : 0}>
      <Tag fill="#0b1220" opacity={0.82} cornerRadius={3} />
      <Text
        text={text}
        fontFamily="Sarabun"
        fontSize={12}
        fontStyle="600"
        fill={color}
        padding={4}
      />
    </Label>
  );
}
