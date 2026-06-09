/**
 * Dropdown menu — เพิ่ม BOQ row จาก preset ว.809 (one-click)
 */
import { useEffect, useRef, useState } from 'react';
import { LABOR_PRESETS_W809, type LaborPreset } from '@/core/wage809';
import { useBOQStore } from '@/stores/boqStore';
import type { BOQItem } from '@/types/boq';

export function AddPresetMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handlePick = (preset: LaborPreset) => {
    const now = new Date().toISOString();
    const item: BOQItem = {
      id: crypto.randomUUID(),
      category: preset.category,
      name: preset.name,
      unit: preset.unit,
      quantity: 0,
      unitPrice: preset.rate,
      isMaterial: false,
      wastePct: 0, // BOQ = net · เผื่อคิดที่ ปร.4 (r19)
      thickness: preset.needsThickness ? 0.1 : undefined,
      source: 'preset',
      sourceRef: preset.id,
      createdAt: now,
      updatedAt: now,
    };
    useBOQStore.getState().add(item);
    setOpen(false);
  };

  const grouped: Record<string, LaborPreset[]> = {};
  for (const p of LABOR_PRESETS_W809) {
    (grouped[p.category] ??= []).push(p);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-bg-border bg-bg-raised px-2.5 py-1 text-xs text-ink-primary hover:bg-bg-hover"
      >
        ＋ เพิ่มจาก ว.809 ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 max-h-96 w-80 overflow-y-auto rounded-md border border-bg-border bg-bg-panel shadow-xl">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat} className="border-b border-bg-border last:border-b-0">
              <div className="bg-bg-raised px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {cat}
              </div>
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePick(p)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-bg-hover"
                >
                  <span className="flex-1 truncate text-left text-ink-primary">
                    {p.name}
                  </span>
                  <span className="font-mono text-[11px] text-ink-secondary">
                    {p.rate.toLocaleString()} /{p.unit}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
