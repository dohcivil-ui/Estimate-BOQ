/**
 * MeasurementsTable — รายการวัดของหน้า active + sync 2 ทางกับ canvas
 * - คลิกแถว → select + ซูมไปยัง bounding box ของรายการนั้น
 * - ดับเบิลคลิก → ตั้งชื่อ
 * - ลบรายการ
 * - สรุปรวม: ความยาว / พื้นที่ / จำนวน
 */
import { useState } from 'react';
import { useActivePage } from '@/stores/drawingStore';
import {
  useMeasurementsForPage,
  useMeasurementStore,
} from '@/stores/measurementStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useCanvasSize } from '@/stores/canvasSizeStore';
import { boundingBox } from '@/core/geometry';
import { CANVAS_COLORS } from './canvas/canvasTheme';
import type { Measurement } from '@/types/measurement';

const TYPE_LABEL: Record<Measurement['type'], string> = {
  length: '📏 ความยาว',
  area: '⬡ พื้นที่',
  count: '🔢 นับจำนวน',
  scale: '📐 สเกล',
};

const TYPE_COLOR: Record<Measurement['type'], string> = {
  length: CANVAS_COLORS.length,
  area: CANVAS_COLORS.area,
  count: CANVAS_COLORS.count,
  scale: CANVAS_COLORS.scale,
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
    return <p className="text-xs text-ink-muted">เปิดแบบก่อนเพื่อเริ่มวัด</p>;
  }

  const pageId = page.id;

  /** คลิกแถว → select + ซูมไปยังรายการนั้น */
  const handleSelect = (m: Measurement) => {
    select(m.id);
    const box = boundingBox(m.points);
    if (!box) return;
    const { width, height } = useCanvasSize.getState();
    useViewportStore.getState().zoomToBox(pageId, box, width, height);
  };

  if (measurements.length === 0) {
    return (
      <div className="rounded border border-dashed border-bg-border p-3 text-center text-xs text-ink-muted">
        ยังไม่มีรายการ เลือกเครื่องมือแล้วคลิกบนแบบเพื่อวัด
      </div>
    );
  }

  const groups = groupByType(measurements);
  const totals = computeTotals(measurements);

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([type, list]) => (
        <div key={type}>
          <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: TYPE_COLOR[type as Measurement['type']] }}
            />
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
                        onClick={() => handleSelect(m)}
                        onDoubleClick={() => {
                          setEditingId(m.id);
                          setEditName(m.name ?? '');
                        }}
                        className="flex-1 truncate text-left text-ink-primary"
                        title="คลิกเพื่อซูมไป · ดับเบิลคลิกเพื่อตั้งชื่อ"
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

      {/* สรุปรวม */}
      <div className="mt-2 space-y-1 rounded border border-bg-border bg-bg-raised p-2.5 text-xs">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          📊 สรุปรวม
        </p>
        {totals.length > 0 && (
          <SummaryRow color={CANVAS_COLORS.length} label="ความยาวรวม" value={`${totals.lengthM.toFixed(2)} ม.`} />
        )}
        {totals.areaCount > 0 && (
          <SummaryRow color={CANVAS_COLORS.area} label="พื้นที่รวม" value={`${totals.areaM2.toFixed(2)} ตร.ม.`} />
        )}
        {totals.countTotal > 0 && (
          <SummaryRow color={CANVAS_COLORS.count} label="จำนวนรวม" value={`${totals.countTotal} จุด`} />
        )}
      </div>
    </div>
  );
}

function SummaryRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-ink-secondary">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="font-mono text-ink-primary">{value}</span>
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

function computeTotals(list: Measurement[]): {
  lengthM: number;
  length: number;
  areaM2: number;
  areaCount: number;
  countTotal: number;
} {
  let lengthM = 0;
  let length = 0;
  let areaM2 = 0;
  let areaCount = 0;
  let countTotal = 0;
  for (const m of list) {
    if (m.type === 'length') {
      lengthM += m.lengthM;
      length++;
    } else if (m.type === 'area') {
      areaM2 += m.areaM2;
      areaCount++;
    } else if (m.type === 'count') {
      countTotal += m.count;
    }
  }
  return { lengthM, length, areaM2, areaCount, countTotal };
}
