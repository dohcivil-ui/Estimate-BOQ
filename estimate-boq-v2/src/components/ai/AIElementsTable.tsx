/**
 * AI Items Table v2 — group by category + confidence pill + source pill + materials/sub_items/accessories breakdown
 */
import { useMemo, useState } from 'react';
import type { AIItem, AIMaterial, AISuggestion, AIConfidence } from '@/types/ai';
import { useAIStore } from '@/stores/aiStore';
import { useBOQStore } from '@/stores/boqStore';
import { itemToBOQItems } from '@/services/aiToBoq';

interface Props {
  suggestions: AISuggestion[];
}

const CONFIDENCE_STYLE: Record<AIConfidence, { text: string; color: string }> = {
  high: { text: '● มั่นใจสูง', color: 'text-success bg-success/10 border-success/30' },
  medium: { text: '● ปานกลาง', color: 'text-warning bg-warning/10 border-warning/30' },
  low: { text: '● ต่ำ — ตรวจ', color: 'text-danger bg-danger/10 border-danger/30' },
  measured: { text: '● วัดจากแบบ', color: 'text-success bg-success/10 border-success/30' },
  calculated: { text: '● คำนวณ', color: 'text-accent bg-accent/10 border-accent/30' },
  estimated: { text: '● ประมาณ', color: 'text-warning bg-warning/10 border-warning/30' },
};

/** safe number for rendering — กัน NaN/undefined ทำ render crash */
function safeNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** safe string — กัน undefined.includes() ฯลฯ */
function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

/** format number → string ไทย แบบกันพัง */
function formatNum(v: unknown, maxFrac = 2): string {
  const n = safeNumber(v, NaN);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('th-TH', { maximumFractionDigits: maxFrac });
}

export function AIElementsTable({ suggestions }: Props) {
  const setStatus = useAIStore((s) => s.setSuggestionStatus);
  const setEdited = useAIStore((s) => s.setSuggestionEdited);
  const setCreatedBoq = useAIStore((s) => s.setSuggestionCreatedBoq);
  const addManyBoq = useBOQStore((s) => s.addMany);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const map = new Map<string, AISuggestion[]>();
    for (const sg of suggestions) {
      const cat = mergedItem(sg).category || 'อื่นๆ';
      const list = map.get(cat) ?? [];
      list.push(sg);
      map.set(cat, list);
    }
    return Array.from(map.entries());
  }, [suggestions]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const acceptOne = (sg: AISuggestion) => {
    const item = mergedItem(sg);
    const rows = itemToBOQItems(item, sg.id);
    if (rows.length === 0) {
      alert('รายการนี้ไม่มีข้อมูลพอที่จะสร้าง BOQ');
      return;
    }
    addManyBoq(rows);
    setCreatedBoq(
      sg.id,
      rows.map((r) => r.id),
    );
    setStatus(sg.id, 'accepted');
  };

  const rejectOne = (sg: AISuggestion) => setStatus(sg.id, 'rejected');

  const acceptAllPending = () => {
    const pending = suggestions.filter((sg) => sg.status === 'pending');
    if (pending.length === 0) return;
    if (!confirm(`Accept ทั้งหมด ${pending.length} รายการ?`)) return;

    const refs: { sgId: string; ids: string[] }[] = [];
    const flat: ReturnType<typeof itemToBOQItems> = [];
    for (const sg of pending) {
      const item = mergedItem(sg);
      const rows = itemToBOQItems(item, sg.id);
      if (rows.length > 0) {
        flat.push(...rows);
        refs.push({ sgId: sg.id, ids: rows.map((r) => r.id) });
      }
    }
    if (flat.length === 0) {
      alert('ไม่มีรายการใดมีข้อมูลพอจะสร้าง BOQ');
      return;
    }
    addManyBoq(flat);
    for (const r of refs) {
      setCreatedBoq(r.sgId, r.ids);
      setStatus(r.sgId, 'accepted');
    }
  };

  if (suggestions.length === 0) {
    return (
      <p className="text-xs text-ink-muted">
        AI ไม่พบ item ในหน้านี้ (หรือยังไม่ได้วิเคราะห์)
      </p>
    );
  }

  const pendingCount = suggestions.filter((sg) => sg.status === 'pending').length;

  return (
    <div className="space-y-3">
      {pendingCount > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={acceptAllPending}
            className="rounded bg-success/20 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/30"
          >
            ✓ Accept ทั้งหมด ({pendingCount})
          </button>
        </div>
      )}

      {grouped.map(([category, items]) => (
        <div key={category}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              {category}
            </span>
            <span className="text-[10px] text-ink-muted">({items.length})</span>
            <div className="h-px flex-1 bg-bg-border" />
          </div>
          <div className="space-y-1">
            {items.map((sg) => (
              <ItemCard
                key={sg.id}
                sg={sg}
                expanded={expanded.has(sg.id)}
                onToggle={() => toggleExpand(sg.id)}
                onAccept={() => acceptOne(sg)}
                onReject={() => rejectOne(sg)}
                onEdit={(patch) => setEdited(sg.id, patch)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemCard({
  sg,
  expanded,
  onToggle,
  onAccept,
  onReject,
  onEdit,
}: {
  sg: AISuggestion;
  expanded: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (patch: Partial<AIItem>) => void;
}) {
  const item = mergedItem(sg);
  const isAccepted = sg.status === 'accepted';
  const isRejected = sg.status === 'rejected';
  const isPending = sg.status === 'pending';
  const breakdowns: AIMaterial[] = [
    ...(item.materials ?? []),
    ...(item.sub_items ?? []),
    ...(item.accessories ?? []),
  ];
  const hasDetails =
    breakdowns.length > 0 || item.labor || item.description || item.dimensions;

  const bg = isAccepted
    ? 'border-success/40 bg-success/5'
    : isRejected
      ? 'border-danger/40 bg-danger/5 opacity-60'
      : 'border-bg-border bg-bg-raised';

  const confidence = item.confidence ?? 'medium';
  const conf = CONFIDENCE_STYLE[confidence];

  return (
    <div className={`rounded border ${bg}`}>
      {/* header */}
      <div className="flex items-start gap-2 px-2 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          disabled={!hasDetails}
          className="mt-0.5 text-ink-muted hover:text-ink-primary disabled:opacity-30"
        >
          {hasDetails ? (expanded ? '▾' : '▸') : '·'}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-1.5 text-xs">
            <span className="font-semibold text-ink-primary">
              {safeString(item.name, '(ไม่มีชื่อ)')}
            </span>
            {item.dimensions && (
              <span className="text-ink-secondary">· {item.dimensions}</span>
            )}
            {item.rebar && <span className="text-cyan-300">· {item.rebar}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="font-mono text-ink-primary">
              {formatNum(item.quantity, 4)} {safeString(item.unit)}
            </span>
            {item.source && (
              <span className="rounded border border-bg-border bg-bg-panel px-1 text-ink-muted">
                {item.source}
              </span>
            )}
            <span className={`rounded border px-1 text-[10px] ${conf.color}`}>
              {conf.text}
            </span>
            {breakdowns.length > 0 && (
              <span className="text-ink-muted">· {breakdowns.length} วัสดุ</span>
            )}
            {item.labor && (
              <span className="rounded bg-amber-500/10 px-1 text-amber-300">
                ค่าแรง {formatNum(item.labor.rate)}/{safeString(item.labor.unit, '—')}
              </span>
            )}
          </div>
          {item.description && (
            <div className="mt-0.5 text-[10px] italic text-ink-muted">
              {item.description}
            </div>
          )}
        </div>

        {isPending && (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={onAccept}
              className="rounded bg-success/20 px-2 py-1 text-[10px] text-success hover:bg-success/30"
              title="ยอมรับ — สร้าง BOQ"
            >
              ✓ Accept
            </button>
            <button
              type="button"
              onClick={onReject}
              className="rounded bg-danger/20 px-2 py-1 text-[10px] text-danger hover:bg-danger/30"
              title="ปฏิเสธ"
            >
              ✕
            </button>
          </div>
        )}
        {isAccepted && (
          <span className="shrink-0 rounded bg-success/20 px-1.5 py-0.5 text-[10px] text-success">
            ✓ {sg.createdBoqIds?.length ?? 0} rows
          </span>
        )}
        {isRejected && (
          <span className="shrink-0 rounded bg-danger/20 px-1.5 py-0.5 text-[10px] text-danger">
            ✕ ปฏิเสธ
          </span>
        )}
      </div>

      {/* expanded body */}
      {expanded && (
        <div className="border-t border-bg-border bg-bg-base/40 p-2 space-y-2">
          {/* edit primary fields */}
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <FieldRow
              label="ชื่อ"
              value={item.name}
              onCommit={(v) => onEdit({ name: v })}
            />
            <FieldRow
              label="quantity"
              type="number"
              value={String(item.quantity ?? 0)}
              onCommit={(v) => onEdit({ quantity: Number(v) || 0 })}
            />
            <FieldRow
              label="unit"
              value={item.unit ?? ''}
              onCommit={(v) => onEdit({ unit: v })}
            />
            <FieldRow
              label="description"
              value={item.description ?? ''}
              onCommit={(v) => onEdit({ description: v || undefined })}
            />
          </div>

          {/* breakdown table */}
          {breakdowns.length > 0 && (
            <BreakdownTable
              items={breakdowns}
              parentQty={item.quantity}
              onUpdate={(idx, patch) => {
                // หา array ที่ idx ตกอยู่ในนั้น แล้วอัปเดต
                const newPatch = updateBreakdown(item, idx, patch);
                onEdit(newPatch);
              }}
              onRemove={(idx) => {
                const newPatch = updateBreakdown(item, idx, null);
                onEdit(newPatch);
              }}
            />
          )}

          {/* labor */}
          {item.labor && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-amber-300">ค่าแรง:</span>
                <span className="text-ink-primary">
                  {safeString(item.labor.description, '(ไม่ระบุ)')}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] text-ink-muted">
                <span className="font-mono text-ink-secondary">
                  {formatNum(item.labor.rate)}
                </span>{' '}
                {safeString(item.labor.unit, '—')}
                {item.labor.ref && (
                  <span className="ml-2">ref: {item.labor.ref}</span>
                )}
              </div>
            </div>
          )}

          {/* structural fallback */}
          {(item.concrete_m3 != null ||
            item.formwork_m2 != null ||
            item.rebar_kg != null) && (
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <FieldRow
                label="concrete/ชิ้น"
                type="number"
                value={String(item.concrete_m3 ?? 0)}
                onCommit={(v) =>
                  onEdit({ concrete_m3: Number(v) || undefined })
                }
              />
              <FieldRow
                label="formwork/ชิ้น"
                type="number"
                value={String(item.formwork_m2 ?? 0)}
                onCommit={(v) =>
                  onEdit({ formwork_m2: Number(v) || undefined })
                }
              />
              <FieldRow
                label="rebar_kg/ชิ้น"
                type="number"
                value={String(item.rebar_kg ?? 0)}
                onCommit={(v) =>
                  onEdit({ rebar_kg: Number(v) || undefined })
                }
              />
            </div>
          )}

          {item.notes && (
            <p className="text-[10px] italic text-ink-muted">📝 {item.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownTable({
  items,
  parentQty,
  onUpdate,
  onRemove,
}: {
  items: AIMaterial[];
  parentQty: number;
  onUpdate: (idx: number, patch: Partial<AIMaterial>) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded border border-bg-border">
      <table className="w-full text-[11px]">
        <thead className="bg-bg-raised text-[10px] uppercase tracking-wider text-ink-muted">
          <tr>
            <th className="px-1 py-1 text-left">รายการ</th>
            <th className="w-16 px-1 py-1 text-right">qty</th>
            <th className="w-14 px-1 py-1 text-center">หน่วย</th>
            <th className="w-16 px-1 py-1 text-right">total</th>
            <th className="w-16 px-1 py-1 text-right">ราคา</th>
            <th className="w-6 px-1 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((sub, idx) => {
            const unit = safeString(sub?.unit);
            const qty = safeNumber(sub?.qty);
            const total =
              typeof sub?.total_qty === 'number' &&
              Number.isFinite(sub.total_qty)
                ? sub.total_qty
                : unit.includes('/')
                  ? qty * (parentQty || 1)
                  : qty;
            return (
              <tr key={idx} className="border-t border-bg-border">
                <td className="px-1 py-1">
                  <EditableCell
                    value={safeString(sub?.name)}
                    onCommit={(v) => onUpdate(idx, { name: v })}
                  />
                  {sub?.note && (
                    <div className="text-[9px] italic text-ink-muted">
                      {sub.note}
                    </div>
                  )}
                </td>
                <td className="px-1 py-1 text-right">
                  <EditableCell
                    value={String(qty)}
                    type="number"
                    align="right"
                    onCommit={(v) => onUpdate(idx, { qty: Number(v) || 0 })}
                  />
                </td>
                <td className="px-1 py-1 text-center">
                  <EditableCell
                    value={unit}
                    align="center"
                    onCommit={(v) => onUpdate(idx, { unit: v })}
                  />
                </td>
                <td className="px-1 py-1 text-right font-mono text-ink-secondary">
                  {formatNum(total)}
                </td>
                <td className="px-1 py-1 text-right">
                  <EditableCell
                    value={
                      sub?.unit_price != null ? String(sub.unit_price) : ''
                    }
                    type="number"
                    align="right"
                    onCommit={(v) =>
                      onUpdate(idx, { unit_price: Number(v) || undefined })
                    }
                  />
                </td>
                <td className="px-1 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="text-ink-muted hover:text-danger"
                    aria-label="ลบ"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function mergedItem(sg: AISuggestion): AIItem {
  return { ...sg.item, ...sg.edited };
}

/** อัปเดต breakdown array — จัดการ index ที่ทับซ้อนระหว่าง materials/sub_items/accessories */
function updateBreakdown(
  item: AIItem,
  flatIdx: number,
  patch: Partial<AIMaterial> | null,
): Partial<AIItem> {
  const mat = (item.materials ?? []).slice();
  const sub = (item.sub_items ?? []).slice();
  const acc = (item.accessories ?? []).slice();

  let i = flatIdx;
  if (i < mat.length) {
    if (patch === null) mat.splice(i, 1);
    else mat[i] = { ...mat[i]!, ...patch };
    return { materials: mat };
  }
  i -= mat.length;
  if (i < sub.length) {
    if (patch === null) sub.splice(i, 1);
    else sub[i] = { ...sub[i]!, ...patch };
    return { sub_items: sub };
  }
  i -= sub.length;
  if (i < acc.length) {
    if (patch === null) acc.splice(i, 1);
    else acc[i] = { ...acc[i]!, ...patch };
    return { accessories: acc };
  }
  return {};
}

function FieldRow({
  label,
  value,
  onCommit,
  type = 'text',
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  type?: 'text' | 'number';
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <EditableCell value={value} onCommit={onCommit} type={type} />
    </label>
  );
}

function EditableCell({
  value,
  onCommit,
  type = 'text',
  align = 'left',
}: {
  value: string;
  onCommit: (v: string) => void;
  type?: 'text' | 'number';
  align?: 'left' | 'right' | 'center';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        type={type === 'number' ? 'number' : 'text'}
        step={type === 'number' ? 'any' : undefined}
        value={draft}
        title="แก้ไขค่า (Enter=บันทึก, Esc=ยกเลิก)"
        aria-label="แก้ไขค่า"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onCommit(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`w-full rounded border border-accent bg-bg-base px-1 py-0.5 text-xs text-ink-primary outline-none text-${align}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={`block w-full truncate rounded px-1 py-0.5 hover:bg-bg-hover text-${align} ${value ? 'text-ink-primary' : 'text-ink-muted'}`}
      title="คลิกเพื่อแก้ไข"
    >
      {value || '—'}
    </button>
  );
}
