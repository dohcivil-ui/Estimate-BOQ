/**
 * Modal: ดึงราคา + ตรวจ BOQ items ที่เป็นวัสดุ → suggest apply ราคาจังหวัด
 * - ใช้ material_prices ที่ admin บันทึก
 * - match ด้วย ilike (substring) เปรียบ item name
 */
import { useEffect, useMemo, useState } from 'react';
import { useBOQStore } from '@/stores/boqStore';
import { useProjectMeta } from '@/stores/projectMetaStore';
import { listMaterialPrices, type AdminMaterialPrice } from '@/services/adminApi';
import type { BOQItem } from '@/types/boq';

interface Props {
  onClose: () => void;
}

interface SuggestRow {
  item: BOQItem;
  match: AdminMaterialPrice | null;
  apply: boolean;
}

export function SyncPricesModal({ onClose }: Props) {
  const items = useBOQStore((s) => s.items);
  const updateItem = useBOQStore((s) => s.update);
  const province = useProjectMeta((s) => s.province);
  const [rows, setRows] = useState<SuggestRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!province.trim()) {
      setErr('โครงการยังไม่ได้ตั้งจังหวัด — แท็บ BOQ → ข้อมูลโครงการ → จังหวัด');
      setRows([]);
      return;
    }
    void (async () => {
      try {
        const prices = await listMaterialPrices(province);
        const next: SuggestRow[] = items.map((it) => {
          // match แบบ loose: ilike substring (ทั้ง 2 ทาง)
          const m =
            prices.find((p) => p.unit === it.unit && itemNameMatch(p.item, it.name)) ??
            null;
          return {
            item: it,
            match: m,
            apply: !!m && m.price !== it.unitPrice,
          };
        });
        setRows(next);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [items, province]);

  const changeCount = useMemo(
    () => rows?.filter((r) => r.apply && r.match).length ?? 0,
    [rows],
  );

  const handleApply = () => {
    if (!rows) return;
    let n = 0;
    for (const r of rows) {
      if (r.apply && r.match) {
        updateItem(r.item.id, { unitPrice: r.match.price });
        n++;
      }
    }
    alert(`อัปเดต ${n} รายการเรียบร้อย`);
    onClose();
  };

  const toggle = (idx: number) => {
    setRows((rs) =>
      rs ? rs.map((r, i) => (i === idx ? { ...r, apply: !r.apply } : r)) : rs,
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg border border-bg-border bg-bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-bg-border p-4">
          <h3 className="text-base font-semibold text-ink-primary">
            🔄 ดึงราคารายจังหวัด: <span className="text-accent">{province || '—'}</span>
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
          {err && (
            <div className="rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
              {err}
            </div>
          )}

          {rows === null ? (
            <p className="text-center text-xs text-ink-muted">กำลังโหลด…</p>
          ) : rows.length === 0 ? (
            <p className="rounded border border-dashed border-bg-border p-6 text-center text-xs text-ink-muted">
              ยังไม่มี BOQ rows
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
                <tr className="border-b border-bg-border">
                  <th className="w-8 py-2 text-center">apply</th>
                  <th className="py-2 text-left">รายการ</th>
                  <th className="w-20 py-2 text-right">ราคาเดิม</th>
                  <th className="w-20 py-2 text-right">ราคาจังหวัด</th>
                  <th className="w-20 py-2 text-right">+/-</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const diff = r.match ? r.match.price - r.item.unitPrice : null;
                  return (
                    <tr
                      key={r.item.id}
                      className="border-b border-bg-border hover:bg-bg-hover"
                    >
                      <td className="py-1.5 text-center">
                        {r.match ? (
                          <input
                            type="checkbox"
                            checked={r.apply}
                            onChange={() => toggle(idx)}
                            className="accent-accent"
                          />
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="py-1.5 text-xs">
                        <div className="text-ink-primary">{r.item.name}</div>
                        <div className="text-[10px] text-ink-muted">
                          {r.item.unit} · {r.item.category}
                        </div>
                      </td>
                      <td className="py-1.5 text-right font-mono text-xs text-ink-secondary">
                        {r.item.unitPrice.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-right font-mono text-xs text-ink-primary">
                        {r.match ? r.match.price.toFixed(2) : '—'}
                      </td>
                      <td
                        className={`py-1.5 text-right font-mono text-xs ${
                          diff == null
                            ? 'text-ink-muted'
                            : diff > 0
                              ? 'text-warning'
                              : diff < 0
                                ? 'text-success'
                                : 'text-ink-muted'
                        }`}
                      >
                        {diff == null
                          ? '—'
                          : (diff > 0 ? '+' : '') + diff.toFixed(2)}
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
            onClick={handleApply}
            disabled={changeCount === 0}
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-ink-inverse hover:bg-accent-hover disabled:opacity-50"
          >
            ✅ ปรับใช้ ({changeCount})
          </button>
        </div>
      </div>
    </div>
  );
}

/** match item name แบบ loose: ilike substring (2 ทิศทาง) */
function itemNameMatch(price: string, item: string): boolean {
  const a = price.trim().toLowerCase();
  const b = item.trim().toLowerCase();
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}
