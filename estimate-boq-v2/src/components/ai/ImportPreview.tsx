/**
 * ImportPreview — modal ก่อน import เข้า BOQ
 *
 *  - แสดง items[] เป็น list พร้อม checkbox + confidence badge
 *  - default check: confidence ∈ {high, measured, undefined} → ☑ checked
 *                   confidence ∈ {medium, calculated} → ☐ unchecked (no warn)
 *                   confidence ∈ {low, estimated} → ☐ unchecked + ⚠️ highlight
 *  - ปุ่ม "Import ที่เลือก (N)" → callback onConfirm(selectedItems)
 *  - Escape / click backdrop / ยกเลิก → onClose
 */
import { useEffect, useMemo, useState } from 'react';
import type { AIConfidence, AIItem } from '@/types/ai';

interface Props {
  items: AIItem[];
  /** label แสดงใน header (เช่น "🏗️ โครงสร้าง — หน้า 17") */
  headerLabel?: string;
  onConfirm: (selectedItems: AIItem[]) => void;
  onClose: () => void;
}

/** map confidence → severity (controls default-check + highlight) */
function severityOf(c: AIConfidence | undefined): 'ok' | 'warn' | 'danger' {
  if (!c) return 'ok';
  if (c === 'high' || c === 'measured') return 'ok';
  if (c === 'medium' || c === 'calculated') return 'warn';
  return 'danger'; // low / estimated
}

function confidenceLabel(c: AIConfidence | undefined): string {
  switch (c) {
    case 'high':
      return '🟢 high';
    case 'measured':
      return '🟢 measured';
    case 'medium':
      return '🟡 medium';
    case 'calculated':
      return '🟡 calculated';
    case 'low':
      return '🔴 low';
    case 'estimated':
      return '🔴 estimated';
    default:
      return '⚪ —';
  }
}

export function ImportPreview({
  items,
  headerLabel,
  onConfirm,
  onClose,
}: Props) {
  // default selection: เลือกเฉพาะ severity=ok (high/measured/no confidence)
  const initialSelected = useMemo(() => {
    const s = new Set<number>();
    items.forEach((it, i) => {
      if (severityOf(it.confidence) === 'ok') s.add(i);
    });
    return s;
  }, [items]);

  const [selected, setSelected] = useState<Set<number>>(initialSelected);

  // Escape ปิด modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(items.map((_, i) => i)));
  const selectNone = () => setSelected(new Set());
  const selectHighOnly = () => {
    const s = new Set<number>();
    items.forEach((it, i) => {
      if (severityOf(it.confidence) === 'ok') s.add(i);
    });
    setSelected(s);
  };

  const handleConfirm = () => {
    const picked: AIItem[] = [];
    items.forEach((it, i) => {
      if (selected.has(i)) picked.push(it);
    });
    onConfirm(picked);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-bg-border bg-bg-panel shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-bg-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-primary">
              📥 Import to BOQ
            </h2>
            {headerLabel && (
              <p className="text-[11px] text-ink-muted">{headerLabel}</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={selectAll}
              className="rounded border border-bg-border bg-bg-raised px-2 py-1 text-ink-secondary hover:bg-bg-hover"
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={selectHighOnly}
              className="rounded border border-bg-border bg-bg-raised px-2 py-1 text-ink-secondary hover:bg-bg-hover"
            >
              เฉพาะมั่นใจสูง
            </button>
            <button
              type="button"
              onClick={selectNone}
              className="rounded border border-bg-border bg-bg-raised px-2 py-1 text-ink-secondary hover:bg-bg-hover"
            >
              ล้าง
            </button>
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-ink-muted">
              ไม่มี item ให้ import
            </p>
          ) : (
            <ul className="space-y-1.5">
              {items.map((it, i) => (
                <PreviewRow
                  key={i}
                  item={it}
                  checked={selected.has(i)}
                  onToggle={() => toggle(i)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-2 border-t border-bg-border px-4 py-3">
          <p className="text-[11px] text-ink-muted">
            เลือก {selected.size} / {items.length} รายการ
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-bg-border bg-bg-raised px-3 py-1.5 text-xs text-ink-secondary hover:bg-bg-hover"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-ink-inverse hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              📥 Import ที่เลือก ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({
  item,
  checked,
  onToggle,
}: {
  item: AIItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const sev = severityOf(item.confidence);
  const borderCls =
    sev === 'danger'
      ? 'border-warning/40 bg-warning/5'
      : sev === 'warn'
        ? 'border-amber-400/30 bg-amber-400/5'
        : 'border-bg-border bg-bg-raised';

  // ระบุ breakdown count (materials/sub_items/accessories)
  const breakdownCount =
    (item.materials?.length ?? 0) +
    (item.sub_items?.length ?? 0) +
    (item.accessories?.length ?? 0);

  return (
    <li
      className={`flex gap-2 rounded border px-2 py-1.5 text-xs ${borderCls}`}
    >
      <label className="flex shrink-0 cursor-pointer items-start pt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-3.5 w-3.5 accent-accent"
        />
      </label>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[10px] text-ink-muted">{item.category}</span>
          <span className="font-medium text-ink-primary">{item.name}</span>
          {item.dimensions && (
            <span className="font-mono text-[11px] text-ink-secondary">
              {item.dimensions}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-secondary">
          <span>
            <span className="font-mono text-ink-primary">{item.quantity}</span>{' '}
            {item.unit}
          </span>
          <span className="text-ink-muted">
            {confidenceLabel(item.confidence)}
          </span>
          {item.source && (
            <span className="text-ink-muted">· {String(item.source)}</span>
          )}
          {breakdownCount > 0 && (
            <span className="text-ink-muted">
              · {breakdownCount} วัสดุย่อย
            </span>
          )}
        </div>
        {item.notes && (
          <p className="mt-0.5 truncate text-[11px] text-ink-muted">
            📝 {item.notes}
          </p>
        )}
        {item.description && (
          <p className="mt-0.5 truncate text-[11px] text-ink-muted">
            {item.description}
          </p>
        )}
      </div>
    </li>
  );
}
