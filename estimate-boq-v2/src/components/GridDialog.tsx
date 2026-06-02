/**
 * GridDialog — popup นิยาม "grid ฐานราก" (กฎ 11 grid-first)
 * --------------------------------------------------------------------------
 * คนกรอกแกน long/short + ชนิดฐานจุดตัด + ฐานพิเศษนอกจุดตัด (extras)
 *   - โค้ดนับจุดตัดให้ (enumerateGrid) แล้ว reconcile กับจำนวนที่ระบายบนแบบ
 *   - preview สด: โชว์จำนวนที่นับได้ หรือ error ถ้านิยามไม่สมเหตุผล
 *   - overrides (เปลี่ยนชนิดเฉพาะจุด) — ยังไม่รองรับรอบนี้
 * Save → setGrid(def) → BOQ preview recompute + ติดธง 🚩 ถ้าจำนวนต่าง
 */
import { useState } from 'react';
import { enumerateGrid, type GridDef } from '@/services/compute/gridModel';

interface Props {
  existing: GridDef | null;
  onSave: (grid: GridDef) => void;
  onClear: () => void;
  onClose: () => void;
}

/** "1,2,3" → ["1","2","3"] (ตัดช่องว่าง + ค่าว่างทิ้ง) */
function splitAxis(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

interface ExtraRow {
  mark: string;
  count: string;
}

export function GridDialog({ existing, onSave, onClear, onClose }: Props) {
  const [longRaw, setLongRaw] = useState(existing ? existing.longAxis.join(',') : '');
  const [shortRaw, setShortRaw] = useState(existing ? existing.shortAxis.join(',') : '');
  const [mark, setMark] = useState(existing?.intersectionMark ?? '');
  const [extras, setExtras] = useState<ExtraRow[]>(
    existing && existing.extras && existing.extras.length > 0
      ? existing.extras.map((e) => ({ mark: e.mark, count: String(e.count) }))
      : [],
  );

  const longAxis = splitAxis(longRaw);
  const shortAxis = splitAxis(shortRaw);

  // แถว extras ที่กรอกชนิดแล้ว (ค่าว่าง = ข้าม)
  const extrasValid = extras
    .filter((e) => e.mark.trim() !== '')
    .map((e) => ({ mark: e.mark.trim(), count: Number(e.count) }));
  const extrasBad = extrasValid.some((e) => !Number.isInteger(e.count) || e.count < 0);

  const canSave =
    longAxis.length > 0 && shortAxis.length > 0 && mark.trim() !== '' && !extrasBad;

  // preview สด — ห่อ try/catch กัน throw ถ้านิยามยังไม่สมเหตุผล
  const buildDef = (): GridDef => ({
    longAxis,
    shortAxis,
    intersectionMark: mark.trim(),
    ...(extrasValid.length > 0 ? { extras: extrasValid } : {}),
  });

  let preview: { total: number; intersection: number; extra: number } | null = null;
  let previewErr: string | null = null;
  if (canSave) {
    try {
      const r = enumerateGrid(buildDef());
      preview = { total: r.total, intersection: r.intersectionTotal, extra: r.extraTotal };
    } catch (e) {
      previewErr = e instanceof Error ? e.message : 'นิยามไม่สมเหตุผล';
    }
  }

  const setExtra = (i: number, patch: Partial<ExtraRow>) =>
    setExtras((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-3 rounded-lg border border-bg-border bg-bg-base p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-primary">
            นิยาม grid ฐานราก
            <span className="ml-1 text-xs text-ink-muted">(กฎ 11 grid-first)</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 text-ink-muted hover:bg-bg-hover"
          >
            ✕
          </button>
        </div>

        <TxtIn
          label='แกนยาว — คั่นด้วยจุลภาค (เช่น "1,2,3,4,5,6")'
          value={longRaw}
          onChange={setLongRaw}
          bad={longAxis.length === 0}
        />
        <TxtIn
          label='แกนสั้น — คั่นด้วยจุลภาค (เช่น "A,B")'
          value={shortRaw}
          onChange={setShortRaw}
          bad={shortAxis.length === 0}
        />
        <TxtIn
          label='ชนิดฐานที่ทุกจุดตัด (เช่น "F2")'
          value={mark}
          onChange={setMark}
          bad={mark.trim() === ''}
        />

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-ink-muted">
              ฐานพิเศษนอกจุดตัด (บวกเข้า ไม่หัก) — ถ้ามี
            </span>
            <button
              type="button"
              onClick={() => setExtras((r) => [...r, { mark: '', count: '' }])}
              className="rounded bg-bg-raised px-2 py-0.5 text-[10px] text-ink-secondary hover:bg-bg-hover"
            >
              + เพิ่มแถว
            </button>
          </div>
          {extras.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={row.mark}
                onChange={(e) => setExtra(i, { mark: e.target.value })}
                placeholder="รหัส เช่น F1"
                className="flex-1 rounded border border-bg-border bg-bg-raised px-2 py-1 text-xs text-ink-primary"
              />
              <input
                inputMode="numeric"
                value={row.count}
                onChange={(e) => setExtra(i, { count: e.target.value })}
                placeholder="จำนวน"
                className={`w-20 rounded border bg-bg-raised px-2 py-1 text-xs text-ink-primary ${
                  row.mark.trim() !== '' &&
                  (!Number.isInteger(Number(row.count)) || Number(row.count) < 0)
                    ? 'border-danger'
                    : 'border-bg-border'
                }`}
              />
              <button
                type="button"
                onClick={() => setExtras((r) => r.filter((_, idx) => idx !== i))}
                className="rounded px-1.5 text-ink-muted hover:bg-bg-hover"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {preview && (
          <p className="rounded bg-bg-raised px-2 py-1 text-[11px] text-ink-secondary">
            นับได้: จุดตัด {longAxis.length}×{shortAxis.length} = {preview.intersection}
            {preview.extra > 0 && ` + พิเศษ ${preview.extra}`} ·{' '}
            <span className="font-semibold text-accent">รวม {preview.total} ฐาน</span>
          </p>
        )}
        {previewErr && (
          <p className="text-[11px] text-warning">⚠️ {previewErr}</p>
        )}

        <div className="flex gap-2 pt-1">
          {existing && (
            <button
              type="button"
              onClick={() => {
                onClear();
                onClose();
              }}
              className="rounded bg-danger/15 px-3 py-1.5 text-xs text-danger hover:bg-danger/25"
            >
              ลบ grid
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onSave(buildDef());
              onClose();
            }}
            disabled={!canSave}
            className="ml-auto rounded bg-accent px-4 py-1.5 text-xs font-medium text-ink-inverse hover:opacity-90 disabled:opacity-40"
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ช่องกรอกข้อความย่อย ────────────────────────────────────
function TxtIn({
  label,
  value,
  onChange,
  bad,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  bad: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] text-ink-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded border bg-bg-raised px-2 py-1 text-xs text-ink-primary ${
          bad ? 'border-danger' : 'border-bg-border'
        }`}
      />
    </label>
  );
}
