/**
 * Admin tab — CRUD ราคาวัสดุรายจังหวัด (Step 2.9)
 * scheduled scraper จาก สนค. (index.tpso.go.th) เป็น future work — ตอนนี้ admin กรอกเอง
 */
import { useEffect, useMemo, useState } from 'react';
import {
  deleteMaterialPrice,
  listMaterialPrices,
  upsertMaterialPrice,
  type AdminMaterialPrice,
} from '@/services/adminApi';
import { THAI_PROVINCES } from '@/constants/thaiProvinces';

interface DraftRow {
  province: string;
  item: string;
  unit: string;
  price: string;
}

const EMPTY_DRAFT: DraftRow = {
  province: '',
  item: '',
  unit: 'กก.',
  price: '',
};

export function AdminMaterialPricesTab() {
  const [items, setItems] = useState<AdminMaterialPrice[] | null>(null);
  const [filter, setFilter] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftRow>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    try {
      setItems(await listMaterialPrices());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    if (!items) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.province.toLowerCase().includes(q) ||
        it.item.toLowerCase().includes(q) ||
        it.unit.toLowerCase().includes(q),
    );
  }, [items, filter]);

  const handleAdd = async () => {
    setErr(null);
    const price = Number(draft.price);
    if (!draft.province.trim() || !draft.item.trim() || !draft.unit.trim()) {
      setErr('กรุณากรอก จังหวัด/รายการ/หน่วย ให้ครบ');
      return;
    }
    if (!isFinite(price) || price <= 0) {
      setErr('ราคาต้องเป็นตัวเลขมากกว่า 0');
      return;
    }
    setSubmitting(true);
    try {
      await upsertMaterialPrice({
        province: draft.province.trim(),
        item: draft.item.trim(),
        unit: draft.unit.trim(),
        price,
        source: 'manual',
      });
      setDraft(EMPTY_DRAFT);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPrice = async (it: AdminMaterialPrice, raw: string) => {
    const n = Number(raw);
    if (!isFinite(n) || n <= 0) return;
    if (n === it.price) return;
    try {
      await upsertMaterialPrice({
        id: it.id,
        province: it.province,
        item: it.item,
        unit: it.unit,
        price: n,
      });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (it: AdminMaterialPrice) => {
    if (!confirm(`ลบราคา "${it.item}" (${it.province})?`)) return;
    try {
      await deleteMaterialPrice(it.id);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded border border-warning/30 bg-warning/5 p-2 text-[11px] text-ink-secondary">
        💡 <b>Step 2.9:</b> ตอนนี้ admin กรอกราคารายจังหวัดเอง — scheduled scraper
        จาก <code>index.tpso.go.th</code> (สนค.) จะทำในเฟสถัดไป
      </div>

      {/* Add new */}
      <div className="rounded border border-bg-border bg-bg-raised p-2">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
          ＋ เพิ่ม / อัปเดตราคา
        </h4>
        <div className="grid grid-cols-12 gap-2">
          <select
            value={draft.province}
            onChange={(e) =>
              setDraft((d) => ({ ...d, province: e.target.value }))
            }
            className="col-span-3 rounded border border-bg-border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent"
          >
            <option value="">— เลือกจังหวัด —</option>
            {THAI_PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={draft.item}
            onChange={(e) =>
              setDraft((d) => ({ ...d, item: e.target.value }))
            }
            placeholder="รายการ (เช่น เหล็ก DB16)"
            className="col-span-4 rounded border border-bg-border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent"
          />
          <input
            type="text"
            value={draft.unit}
            onChange={(e) =>
              setDraft((d) => ({ ...d, unit: e.target.value }))
            }
            placeholder="หน่วย"
            className="col-span-2 rounded border border-bg-border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent"
          />
          <input
            type="number"
            step="any"
            min="0"
            value={draft.price}
            onChange={(e) =>
              setDraft((d) => ({ ...d, price: e.target.value }))
            }
            placeholder="ราคา"
            className="col-span-2 rounded border border-bg-border bg-bg-base px-2 py-1 text-right text-xs text-ink-primary outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={submitting}
            className="col-span-1 rounded bg-accent px-2 py-1 text-xs font-medium text-ink-inverse hover:bg-accent-hover disabled:opacity-50"
          >
            ＋
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
          {err}
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="ค้นหา (จังหวัด/รายการ/หน่วย)..."
        className="w-full rounded border border-bg-border bg-bg-base px-2 py-1 text-xs text-ink-primary outline-none focus:border-accent"
      />

      {filtered === null ? (
        <p className="text-center text-xs text-ink-muted">กำลังโหลด…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded border border-dashed border-bg-border p-6 text-center text-xs text-ink-muted">
          ยังไม่มีข้อมูลราคา — เริ่มเพิ่มด้านบน
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
            <tr className="border-b border-bg-border">
              <th className="py-2 text-left">จังหวัด</th>
              <th className="py-2 text-left">รายการ</th>
              <th className="w-16 py-2 text-center">หน่วย</th>
              <th className="w-24 py-2 text-right">ราคา (บ.)</th>
              <th className="w-20 py-2 text-left">ที่มา</th>
              <th className="w-8 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <tr
                key={it.id}
                className="border-b border-bg-border hover:bg-bg-hover"
              >
                <td className="py-1.5 text-xs text-ink-primary">{it.province}</td>
                <td className="py-1.5 text-xs text-ink-primary">{it.item}</td>
                <td className="py-1.5 text-center text-xs text-ink-secondary">
                  {it.unit}
                </td>
                <td className="py-1.5 text-right">
                  <input
                    type="number"
                    step="any"
                    defaultValue={it.price}
                    onBlur={(e) => handleEditPrice(it, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className="w-full rounded border border-transparent bg-transparent px-1 text-right font-mono text-xs text-ink-primary outline-none hover:border-bg-border focus:border-accent"
                  />
                </td>
                <td className="py-1.5 text-[11px] text-ink-muted">
                  {it.source ?? '—'}
                </td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(it)}
                    className="text-ink-muted hover:text-danger"
                    aria-label="ลบ"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
