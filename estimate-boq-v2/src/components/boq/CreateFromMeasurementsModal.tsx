/**
 * Modal: สร้าง BOQ จากค่าวัดที่เลือก
 * - เลือก measurement → เลือก preset ว.809 ที่จะใช้ → สร้าง BOQItem พร้อม linked sourceRef
 */
import { useMemo, useState } from 'react';
import { useMeasurementStore } from '@/stores/measurementStore';
import { useBOQStore } from '@/stores/boqStore';
import {
  LABOR_PRESETS_W809,
  type LaborPreset,
  type LaborUnit,
} from '@/core/wage809';
import type { Measurement } from '@/types/measurement';
import type { BOQItem } from '@/types/boq';

interface Props {
  onClose: () => void;
}

export function CreateFromMeasurementsModal({ onClose }: Props) {
  const measurements = useMeasurementStore((s) => s.measurements);
  const addMany = useBOQStore((s) => s.addMany);

  /** map: measurementId → presetId ที่ user เลือก */
  const [picks, setPicks] = useState<Record<string, string>>({});

  const eligible = useMemo(
    () => measurements.filter((m) => m.type !== 'scale'),
    [measurements],
  );

  /** filter preset list ตามหน่วยที่ตรงกับ measurement */
  const presetsFor = (m: Measurement): LaborPreset[] => {
    const targetUnit = unitForMeasurement(m);
    return LABOR_PRESETS_W809.filter((p) => {
      // ตร.ม. preset ทำงานกับทั้ง area และ length (สำหรับงานเส้นกว้าง — ผู้ใช้กรอกความหนาเพิ่ม)
      if (m.type === 'area') return p.unit === 'ตร.ม.' || p.unit === 'ลบ.ม.';
      if (m.type === 'length') return p.unit === 'เมตร';
      if (m.type === 'count') return p.unit === 'จุด' || p.unit === 'ชุด';
      return p.unit === targetUnit;
    });
  };

  const handleCreate = () => {
    const now = new Date().toISOString();
    const newItems: BOQItem[] = [];

    for (const m of eligible) {
      const presetId = picks[m.id];
      if (!presetId) continue;
      const preset = LABOR_PRESETS_W809.find((p) => p.id === presetId);
      if (!preset) continue;

      const qty = quantityForMeasurement(m, preset);
      const needsThickness = preset.unit === 'ลบ.ม.' && m.type === 'area';

      newItems.push({
        id: crypto.randomUUID(),
        category: preset.category,
        name: preset.name,
        unit: preset.unit,
        quantity: qty,
        unitPrice: preset.rate,
        isMaterial: false,
        wastePct: 0, // BOQ = net · เผื่อคิดที่ ปร.4 (r19)
        thickness: needsThickness ? 0.1 : undefined,
        source: 'measurement',
        sourceRef: m.id,
        notes: m.name || undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (newItems.length === 0) {
      alert('โปรดเลือก preset ของอย่างน้อย 1 รายการ');
      return;
    }
    addMany(newItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg border border-bg-border bg-bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-bg-border p-4">
          <h3 className="text-base font-semibold text-ink-primary">
            📐 สร้าง BOQ จากค่าวัด
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xl text-ink-muted hover:text-ink-primary"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {eligible.length === 0 ? (
            <p className="text-center text-xs text-ink-muted">
              ยังไม่มีค่าวัด (เปิดแบบ + วัดก่อน)
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-ink-muted">
                <tr className="border-b border-bg-border">
                  <th className="py-1 text-left">ค่าวัด</th>
                  <th className="py-1 text-right">ปริมาณ</th>
                  <th className="py-1 text-left">เลือก preset ว.809</th>
                </tr>
              </thead>
              <tbody>
                {eligible.map((m) => {
                  const presets = presetsFor(m);
                  return (
                    <tr key={m.id} className="border-b border-bg-border">
                      <td className="py-2 text-ink-primary">
                        {m.name || m.label}
                        <div className="text-[10px] text-ink-muted">
                          ประเภท {m.type}
                        </div>
                      </td>
                      <td className="py-2 text-right font-mono text-ink-secondary">
                        {quantityDisplay(m)}
                      </td>
                      <td className="py-2">
                        {presets.length === 0 ? (
                          <span className="text-ink-muted">— ไม่มี preset ที่ตรง —</span>
                        ) : (
                          <select
                            value={picks[m.id] ?? ''}
                            onChange={(e) =>
                              setPicks((p) => ({ ...p, [m.id]: e.target.value }))
                            }
                            className="w-full rounded border border-bg-border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent"
                          >
                            <option value="">— ไม่สร้างจากรายการนี้ —</option>
                            {presets.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.rate}/{p.unit})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-bg-border p-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-bg-border bg-bg-raised px-3 py-1.5 text-sm text-ink-secondary hover:bg-bg-hover"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={Object.values(picks).filter(Boolean).length === 0}
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-ink-inverse hover:bg-accent-hover disabled:opacity-50"
          >
            ✅ สร้างรายการ ({Object.values(picks).filter(Boolean).length})
          </button>
        </div>
      </div>
    </div>
  );
}

function unitForMeasurement(m: Measurement): LaborUnit {
  if (m.type === 'area') return 'ตร.ม.';
  if (m.type === 'length') return 'เมตร';
  if (m.type === 'count') return 'จุด';
  return 'ชุด';
}

function quantityForMeasurement(m: Measurement, preset: LaborPreset): number {
  if (m.type === 'area') return m.areaM2;
  if (m.type === 'length') return m.lengthM;
  if (m.type === 'count') return m.count;
  // scale ไม่ควรเข้ามาที่นี่
  void preset;
  return 0;
}

function quantityDisplay(m: Measurement): string {
  if (m.type === 'area') return `${m.areaM2.toFixed(2)} ตร.ม.`;
  if (m.type === 'length') return `${m.lengthM.toFixed(2)} ม.`;
  if (m.type === 'count') return `${m.count} จุด`;
  if (m.type === 'scale') return `${m.realDistance} ${m.unit}`;
  return '—';
}
