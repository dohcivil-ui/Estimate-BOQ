/**
 * DetectionLayer — ไฮไลต์/ระบายชิ้นงาน BOQ บนแบบ (page-px → screen)
 * --------------------------------------------------------------------------
 * - footing → วาดเป็น "วงแหวน" (เว้นช่องเสาที่ center อยู่ในกล่องฐาน) ด้วย
 *     Shape + sceneFunc + even-odd fill rule
 * - column → กล่องทึบ fill@.18 (วาดทับฐาน)
 * - beam/slab/other → กล่อง fill@.12
 *     draft     = เส้นประ [6,4] + alpha ลด + " ?" บน pill
 *     confirmed = เส้นทึบ
 *     selected  = กรอบขาวประ [4,4] ซ้อนนอก
 * - pill รหัส mark → ขึ้นเฉพาะ member ที่ hover หรือถูกเลือก
 * - แสดง preview กล่องตอนกำลังลากระบาย (paint tool)
 *
 * listening={false} ทั้ง layer — hit test ทำใน useCanvasInteraction (geometric)
 *   ⚠️ ห้าม moveToTop (กฎผู้ใช้) — ใช้ลำดับ layer ใน CanvasArea ตายตัว
 */
import { Layer, Group, Rect, Shape, Label, Tag, Text } from 'react-konva';
import type { ViewTransform } from '@/types/viewport';
import {
  useMembersForPage,
  useDetectionStore,
  type Member,
} from '@/stores/detectionStore';
import { useToolStore } from '@/stores/toolStore';
import { contrastText } from '@/services/markColors';

interface Props {
  pageId: string;
  transform: ViewTransform;
}

const PAD = 4; // screen px เผื่อรอบกล่อง (คงที่ทุก zoom)

interface ScreenBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** #rrggbb → rgba(...) ด้วย alpha ที่กำหนด (สำหรับ fill โปร่ง) */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** bbox page-px → screen box (มี PAD เผื่อ) */
function toScreen(g: NonNullable<Member['geometry']>, t: ViewTransform): ScreenBox {
  return {
    x: g.x * t.zoom + t.panX - PAD,
    y: g.y * t.zoom + t.panY - PAD,
    w: g.w * t.zoom + PAD * 2,
    h: g.h * t.zoom + PAD * 2,
  };
}

/** กล่องเสา (screen, ไม่มี PAD) ที่ center อยู่ในกล่องฐาน — null ถ้าไม่มี */
function columnHoleFor(
  footing: Member,
  members: Member[],
  t: ViewTransform,
): ScreenBox | null {
  const fg = footing.geometry;
  if (!fg) return null;
  for (const c of members) {
    if (c.category !== 'column' || !c.geometry) continue;
    const cx = c.geometry.x + c.geometry.w / 2;
    const cy = c.geometry.y + c.geometry.h / 2;
    if (cx >= fg.x && cx <= fg.x + fg.w && cy >= fg.y && cy <= fg.y + fg.h) {
      return {
        x: c.geometry.x * t.zoom + t.panX,
        y: c.geometry.y * t.zoom + t.panY,
        w: c.geometry.w * t.zoom,
        h: c.geometry.h * t.zoom,
      };
    }
  }
  return null;
}

export function DetectionLayer({ pageId, transform }: Props) {
  const members = useMembersForPage(pageId);
  const selectedIds = useDetectionStore((s) => s.selectedIds);
  const hoveredId = useDetectionStore((s) => s.hoveredId);
  const hiddenMarks = useDetectionStore((s) => s.hiddenMarks);
  const hidden = new Set(hiddenMarks);
  const activeTool = useToolStore((s) => s.activeTool);
  const draftPoints = useToolStore((s) => s.draftPoints);
  const cursorPoint = useToolStore((s) => s.cursorPagePoint);
  const sel = new Set(selectedIds);

  const showPreview =
    activeTool === 'paint' && draftPoints.length > 0 && cursorPoint != null;
  const preview = showPreview
    ? rectScreen(draftPoints[0]!, cursorPoint, transform)
    : null;

  return (
    <Layer listening={false}>
      {members.map((m) => {
        const g = m.geometry;
        if (!g) return null;
        if (hidden.has(m.mark)) return null;
        const box = toScreen(g, transform);
        const isDraft = m.status === 'draft';
        const isSel = sel.has(m.id);
        const showPill = isSel || m.id === hoveredId;
        const dash = isDraft ? [6, 4] : undefined;
        const fillAlpha = isDraft ? 0.07 : m.category === 'column' ? 0.18 : 0.12;

        const hole =
          m.category === 'footing'
            ? columnHoleFor(m, members, transform)
            : null;

        return (
          <Group key={m.id}>
            {hole ? (
              <Shape
                sceneFunc={(ctx, shape) => {
                  ctx.beginPath();
                  // outer rect (CW)
                  ctx.rect(box.x, box.y, box.w, box.h);
                  // inner hole (path ที่สอง— even-odd จะเว้นเป็นรู)
                  ctx.rect(hole.x, hole.y, hole.w, hole.h);
                  ctx.closePath();
                  ctx.fillStrokeShape(shape);
                }}
                fill={withAlpha(m.color, isDraft ? 0.12 : 0.22)}
                fillRule="evenodd"
              />
            ) : null}
            <Rect
              x={box.x}
              y={box.y}
              width={box.w}
              height={box.h}
              cornerRadius={8}
              fill={hole ? undefined : withAlpha(m.color, fillAlpha)}
              stroke={m.color}
              strokeWidth={2.5}
              dash={dash}
              opacity={isDraft ? 0.85 : 1}
              shadowColor="#0b1220"
              shadowBlur={6}
              shadowOpacity={0.35}
            />
            {isSel && (
              <Rect
                x={g.x * transform.zoom + transform.panX}
                y={g.y * transform.zoom + transform.panY}
                width={g.w * transform.zoom}
                height={g.h * transform.zoom}
                cornerRadius={0}
                stroke="#ffffff"
                strokeWidth={1.5}
                dash={[4, 4]}
              />
            )}
            {showPill && (
              <Label x={box.x} y={box.y - 26}>
                <Tag fill={m.color} cornerRadius={6} opacity={isDraft ? 0.85 : 1} />
                <Text
                  text={
                    (m.posLabel ? `${m.mark} · ${m.posLabel}` : m.mark) +
                    (isDraft ? ' ?' : '')
                  }
                  fontFamily="Sarabun"
                  fontSize={12}
                  fontStyle="700"
                  fill={contrastText(m.color)}
                  padding={4}
                />
              </Label>
            )}
          </Group>
        );
      })}
      {preview && (
        <Rect
          x={preview.x}
          y={preview.y}
          width={preview.w}
          height={preview.h}
          cornerRadius={8}
          stroke="#ffffff"
          strokeWidth={2}
          dash={[8, 4]}
          fill="rgba(255,255,255,0.08)"
        />
      )}
    </Layer>
  );
}

function rectScreen(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: ViewTransform,
): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.min(a.x, b.x) * t.zoom + t.panX,
    y: Math.min(a.y, b.y) * t.zoom + t.panY,
    w: Math.abs(b.x - a.x) * t.zoom,
    h: Math.abs(b.y - a.y) * t.zoom,
  };
}
