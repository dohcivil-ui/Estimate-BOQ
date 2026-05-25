/**
 * MeasurementsTable — รายการวัดของหน้า active + sync 2 ทางกับ canvas
 * - คลิกแถว → select + (TODO Step 2.3.5) zoom ไป bounding box
 * - ลบ / เปลี่ยนชื่อ
 */
import { useState } from 'react';
import { useActivePage } from '@/stores/drawingStore';
import {
  useMeasurementsForPage,
  useMeasurementStore,
} from '@/stores/measurementStore';
import type { Measurement } from '@/types/measurement';

const TYPE_LABEL: Record<Measurement['type'], string> = {
  length: '📏 ความยาว',
  area: '⬡ พื้นที่',
  count: '🔢 นับจำนวน',
  scale: '📐 สเกล',
};

export function MeasurementsTable() {
  const page = useActivePage();
  const measurements = useMeasurementsForPage(page?.id ?? null);
  const selectedId = useMeasurementStore((s) => s.selectedId);
  const select = useMeasurementStore((s) => s.select);
  const remove = useMeasurementStore((s) => s.remove);
  const update = useMeasurementStore((s) => s.update);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (!page) {
    return (
      <p className="text-xs text-ink-muted">เปิดแบบก่อนเพื่อเริ่มวัด</p>
    );
  }

  if (measurements.length === 0) {
    return (
      <div className="rounded border border-dashed border-bg-border p-3 text-center text-xs text-ink-muted">
        ยังไม่มีรายการ เลือกเครื่องมือแล้วคลิกบนแบบเพื่อวัด
      </div>
    );
  }

  const groups = groupByType(measurements);

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([type, list]) => (
        <div key={type}>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            {TYPE_LABEL[type as Measurement['type']]} ({list.length})
          </h4>
          <ul className="space-y-0.5">
            {list.map((m) => {
              const selected = m.id === selectedId;
              const isEditing = editingId === m.id;
              return (
                <li
                  key={m.id}
                  className={`group rounded border px-2 py-1.5 text-xs transition-colors ${
                    selected
                      ? 'border-accent bg-accent-subtle/40'
                      : 'border-bg-border bg-bg-raised hover:border-ink-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => {
                          update(m.id, { name: editName.trim() || undefined });
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 rounded border border-accent bg-bg-base px-1 py-0.5 text-xs text-ink-primary outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => select(m.id)}
                        onDoubleClick={() => {
                          setEditingId(m.id);
                          setEditName(m.name ?? '');
                        }}
                        className="flex-1 truncate text-left text-ink-primary"
                        title="ดับเบิลคลิกเพื่อตั้งชื่อ"
                      >
                        {m.name || m.label}
                      </button>
                    )}
                    <span className="font-mono text-[11px] text-ink-secondary">
                      {m.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`ลบ "${m.name || m.label}"?`)) remove(m.id);
                      }}
                      className="text-ink-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                      aria-label="ลบ"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function groupByType(list: Measurement[]): Record<string, Measurement[]> {
  const out: Record<string, Measurement[]> = {};
  for (const m of list) {
    (out[m.type] ??= []).push(m);
  }
  return out;
}
