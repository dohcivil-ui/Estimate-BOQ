/**
 * DevPdfProbe — ปุ่ม DEV ชั่วคราว: เลือก PDF แล้วเช็ก vector/raster
 * ผลพิมพ์ใน console (paths/images/ขนาด) + แสดงสรุปย่อในแผง
 * ⚠️ ชั่วคราว — ลบทิ้งได้หลังตัดสินวิธี snap
 */
import { useRef, useState } from 'react';
import { probePdfVectorRaster, type PdfProbePage } from '@/services/devProbePdf';

export function DevPdfProbe() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PdfProbePage[]>([]);
  const [busy, setBusy] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setRows([]);
    try {
      const r = await probePdfVectorRaster(file);
      setRows(r);
    } catch (err) {
      console.error('[pdf-probe] error:', err);
      alert('probe ล้มเหลว — ดู console');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-[11px] text-ink-muted">
      <p className="mb-1 font-semibold text-ink-secondary">
        🧪 DEV — เช็ก PDF vector/raster
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded border border-bg-border bg-bg-raised px-3 py-1.5 text-xs text-ink-primary hover:bg-bg-hover disabled:opacity-60"
      >
        {busy ? 'กำลังเช็ก…' : 'เลือก PDF เช็ก'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={handleChange}
      />
      {rows.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {rows.map((r) => (
            <li key={r.page}>
              p{r.page}: paths={r.paths} images={r.images} {r.width}×{r.height} →{' '}
              <b
                className={
                  r.verdict === 'VECTOR'
                    ? 'text-success'
                    : r.verdict === 'RASTER'
                      ? 'text-warning'
                      : 'text-ink-secondary'
                }
              >
                {r.verdict}
              </b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
