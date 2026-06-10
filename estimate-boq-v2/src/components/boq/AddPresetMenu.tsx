/**
 * Dropdown menu — เพิ่ม BOQ row จาก preset ว.809 (one-click)
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LABOR_PRESETS_W809, type LaborPreset } from '@/core/wage809';
import { useBOQStore } from '@/stores/boqStore';
import type { BOQItem } from '@/types/boq';

const MENU_W = 320; // = w-80 เดิม

export function AddPresetMenu() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = ref.current?.contains(target);
      const inMenu = menuRef.current?.contains(target);
      if (!inTrigger && !inMenu) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // ปิดเมนูเมื่อ scroll/resize (พฤติกรรม native menu)
  useEffect(() => {
    if (!open) return;
    // scroll ในเมนูเอง (เลื่อนรายการ) ไม่ปิด — ปิดเฉพาะ scroll นอกเมนู เช่น SidePanel/page
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    // capture:true เพื่อจับ scroll ของ SidePanel ที่ไม่ bubble
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const top = rect.bottom + 4;
    // พยายามชิดขวาปุ่ม (พฤติกรรมเดิม right-0) แต่ไม่ทะลุซ้าย/ขวา viewport (margin 8px)
    const left = Math.max(
      8,
      Math.min(rect.right - MENU_W, window.innerWidth - MENU_W - 8),
    );
    setPos({ top, left });
    setOpen(true);
  };

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
        onClick={toggleOpen}
        className="rounded border border-bg-border bg-bg-raised px-2.5 py-1 text-xs text-ink-primary hover:bg-bg-hover"
      >
        ＋ เพิ่มจาก ว.809 ▾
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 overflow-y-auto rounded-md border border-bg-border bg-bg-panel shadow-xl"
            style={{
              top: pos.top,
              left: pos.left,
              width: MENU_W,
              maxHeight: Math.min(384, window.innerHeight - pos.top - 8),
            }}
          >
            {Object.entries(grouped).map(([cat, list]) => (
              <div
                key={cat}
                className="border-b border-bg-border last:border-b-0"
              >
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
          </div>,
          document.body,
        )}
    </div>
  );
}
