/**
 * BOQ table — editable แต่ละ cell (ชื่อ/หน่วย/qty/ราคา/หมวด/notes)
 * เผื่อ% ไม่แสดงในตารางนี้ — BOQ = net, ค่าเผื่อคิดที่ ปร.4 (field wastePct ยังคงอยู่ใน type/store)
 */
import { useState } from 'react';
import { useBOQStore } from '@/stores/boqStore';
import { useMeasurementStore } from '@/stores/measurementStore';
import { adjustedQuantity, formatCurrency, rowAmount } from '@/core/boqCalc';
import type { BOQItem, Discipline } from '@/types/boq';
import { DISCIPLINE_LABELS } from '@/types/ai';

type RowItem = BOQItem & { discipline: Discipline };

/** label หมวด = discipline ของ group (auto) — fallback ค่าดิบถ้าไม่มีใน labels */
const disciplineLabel = (d: string): string =>
  (DISCIPLINE_LABELS as Record<string, string>)[d] ?? d;

const SOURCE_LABEL: Record<BOQItem['source'], { text: string; color: string }> = {
  manual: { text: 'มือ', color: 'text-ink-muted' },
  preset: { text: 'ว.809', color: 'text-accent' },
  ai: { text: 'AI', color: 'text-warning' },
  measurement: { text: 'วัด', color: 'text-success' },
};

export function BOQTable() {
  const groups = useBOQStore((s) => s.disciplineGroups);
  const items: RowItem[] = groups.flatMap((g) =>
    g.items.map((it) => ({ ...it, discipline: g.discipline })),
  );
  const update = useBOQStore((s) => s.update);
  const remove = useBOQStore((s) => s.remove);
  const selectMeasurement = useMeasurementStore((s) => s.select);

  if (items.length === 0) {
    return (
      <div className="rounded border border-dashed border-bg-border p-6 text-center text-xs text-ink-muted">
        ยังไม่มีรายการ BOQ
        <br />
        เพิ่มจาก ว.809 / สร้างจากค่าวัด / นำเข้าจาก AI
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-bg-border">
      <table className="w-full text-xs">
        <thead className="bg-bg-raised text-[10px] uppercase tracking-wider text-ink-muted">
          <tr>
            <th className="w-8 px-1 py-1.5 text-center">#</th>
            <th className="px-1 py-1.5 text-left">หมวด</th>
            <th className="px-1 py-1.5 text-left">รายการ</th>
            <th className="w-14 px-1 py-1.5 text-center">หน่วย</th>
            <th className="w-20 px-1 py-1.5 text-right">ปริมาณ</th>
            <th className="w-20 px-1 py-1.5 text-right">ราคา/หน่วย</th>
            <th className="w-24 px-1 py-1.5 text-right">จำนวนเงิน</th>
            <th className="w-10 px-1 py-1.5 text-center">ที่มา</th>
            <th className="w-6 px-1 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <BOQRow
              key={it.id}
              item={it}
              idx={idx}
              onUpdate={(patch) => update(it.id, patch)}
              onRemove={() => {
                if (confirm(`ลบรายการ "${it.name}"?`)) remove(it.id);
              }}
              onJumpToMeasurement={
                it.source === 'measurement' && it.sourceRef
                  ? () => selectMeasurement(it.sourceRef!)
                  : undefined
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BOQRow({
  item,
  idx,
  onUpdate,
  onRemove,
  onJumpToMeasurement,
}: {
  item: RowItem;
  idx: number;
  onUpdate: (patch: Partial<BOQItem>) => void;
  onRemove: () => void;
  onJumpToMeasurement?: () => void;
}) {
  const amount = rowAmount(item);
  const adjQty = adjustedQuantity(item);
  const src = SOURCE_LABEL[item.source];
  const bg = item.isMaterial ? 'bg-blue-500/5' : 'bg-amber-500/5';

  return (
    <tr className={`border-t border-bg-border ${bg} hover:bg-bg-hover`}>
      <td className="px-1 py-1 text-center text-ink-muted">{idx + 1}</td>
      <td className="px-1 py-1">
        <span
          className="block truncate px-1 py-0.5 text-ink-secondary"
          title={`category: ${item.category}`}
        >
          {disciplineLabel(item.discipline)}
        </span>
      </td>
      <td className="px-1 py-1">
        <Cell
          value={item.name}
          onCommit={(v) => onUpdate({ name: v })}
          className="text-ink-primary"
        />
      </td>
      <td className="px-1 py-1 text-center">
        <Cell
          value={item.unit}
          onCommit={(v) => onUpdate({ unit: v })}
          className="text-center text-ink-secondary"
        />
      </td>
      <td className="px-1 py-1 text-right">
        <NumberCell
          value={item.quantity}
          onCommit={(n) => onUpdate({ quantity: n })}
        />
        {item.thickness != null && (
          <div className="text-[10px] text-ink-muted">
            ×{item.thickness.toFixed(3)} m = {adjQty.toFixed(2)}
          </div>
        )}
      </td>
      <td className="px-1 py-1 text-right">
        <NumberCell
          value={item.unitPrice}
          onCommit={(n) => onUpdate({ unitPrice: n })}
        />
      </td>
      <td className="px-1 py-1 text-right font-mono text-ink-primary">
        {formatCurrency(amount)}
      </td>
      <td className={`px-1 py-1 text-center text-[10px] ${src.color}`}>
        {onJumpToMeasurement ? (
          <button
            type="button"
            onClick={onJumpToMeasurement}
            className="underline-offset-2 hover:underline"
            title="ดูค่าวัดต้นทาง"
          >
            {src.text}
          </button>
        ) : (
          src.text
        )}
      </td>
      <td className="px-1 py-1 text-center">
        <button
          type="button"
          onClick={onRemove}
          className="text-ink-muted hover:text-danger"
          aria-label="ลบ"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

function Cell({
  value,
  onCommit,
  className,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
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
        className="w-full rounded border border-accent bg-bg-base px-1 py-0.5 text-xs text-ink-primary outline-none"
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
      className={`block w-full truncate rounded px-1 py-0.5 text-left hover:bg-bg-hover ${className ?? ''}`}
      title="คลิกเพื่อแก้ไข"
    >
      {value || <span className="text-ink-muted">—</span>}
    </button>
  );
}

function NumberCell({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (isFinite(n)) onCommit(n);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className="w-full rounded border border-accent bg-bg-base px-1 py-0.5 text-right text-xs text-ink-primary outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      className="block w-full rounded px-1 py-0.5 text-right font-mono text-xs text-ink-primary hover:bg-bg-hover"
      title="คลิกเพื่อแก้ไข"
    >
      {value.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </button>
  );
}
