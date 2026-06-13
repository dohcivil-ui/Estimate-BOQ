/**
 * GovTemplateExportModal — Export ปร.4/5/6 ลง template ราชการ (boq-master.xlsx) + ตรวจสอบก่อนดาวน์โหลด
 * ─────────────────────────────────────────────────────────────────────────
 * flow: prepareGovTemplateExport (verify) → แสดง error/warn → ผู้ใช้ยืนยัน → downloadGovTemplate
 * - มี error (verify) → บล็อกปุ่มดาวน์โหลด
 * - มี warn → แสดงเตือน แต่ดาวน์โหลดได้
 */
import { useMemo, useState } from 'react';
import { useBOQStore } from '@/stores/boqStore';
import { useProjectMeta } from '@/stores/projectMetaStore';
import { formatCurrency } from '@/core/boqCalc';
import {
  prepareGovTemplateExport,
  downloadGovTemplate,
  type GovTemplatePrep,
} from '@/services/govTemplateExport';

export function GovTemplateExportModal({ onClose }: { onClose: () => void }) {
  const prep = useMemo<{ ok: true; data: GovTemplatePrep } | { ok: false; error: string }>(() => {
    try {
      return {
        ok: true,
        data: prepareGovTemplateExport({
          groups: useBOQStore.getState().disciplineGroups,
          meta: useProjectMeta.getState(),
        }),
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, []);

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!prep.ok || !prep.data.data) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadGovTemplate(prep.data.data, prep.data.fileName);
      onClose();
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  };

  const errors = prep.ok ? prep.data.issues.filter((i) => i.level === 'error') : [];
  const warns = prep.ok ? prep.data.issues.filter((i) => i.level === 'warn') : [];
  const canDownload = prep.ok && prep.data.ok && !!prep.data.data && !downloading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-bg-border bg-bg-panel p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-primary">
            📋 Export ปร.4/5/6 (เทมเพลตราชการ)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink-primary"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        {!prep.ok ? (
          <div className="rounded border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            ⚠️ เตรียมข้อมูลไม่สำเร็จ: {prep.error}
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded border border-bg-border bg-bg-raised px-3 py-2">
              <span className="text-ink-secondary">ค่างานต้นทุน (Direct Cost)</span>
              <span className="font-mono font-semibold text-ink-primary">
                ฿ {formatCurrency(prep.data.directCost)}
              </span>
            </div>

            {errors.length > 0 && (
              <div className="rounded border border-danger/40 bg-danger/10 p-2 text-danger">
                <div className="mb-1 font-semibold">
                  ✗ พบ {errors.length} ข้อผิดพลาด — แก้ก่อนจึงจะ export ได้
                </div>
                <ul className="list-disc space-y-0.5 pl-4">
                  {errors.map((i, k) => (
                    <li key={k}>
                      <span className="font-mono text-[10px] opacity-70">[{i.code}]</span>{' '}
                      {i.where}: {i.msg}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(warns.length > 0 || prep.data.buildWarnings.length > 0) && (
              <div className="rounded border border-warning/40 bg-warning/10 p-2 text-warning">
                <div className="mb-1 font-semibold">
                  ⚠️ คำเตือน {warns.length + prep.data.buildWarnings.length} รายการ (ตรวจก่อนใช้)
                </div>
                <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-4">
                  {warns.map((i, k) => (
                    <li key={`w${k}`}>
                      <span className="font-mono text-[10px] opacity-70">[{i.code}]</span>{' '}
                      {i.where}: {i.msg}
                    </li>
                  ))}
                  {prep.data.buildWarnings.map((w, k) => (
                    <li key={`b${k}`}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {errors.length === 0 && warns.length === 0 && prep.data.buildWarnings.length === 0 && (
              <div className="rounded border border-success/40 bg-success/10 p-2 text-success">
                ✓ ตรวจสอบผ่าน — พร้อมดาวน์โหลด
              </div>
            )}

            {downloadError && (
              <div className="rounded border border-danger/40 bg-danger/10 p-2 text-danger">
                {downloadError}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-bg-border bg-bg-panel px-3 py-1.5 text-xs text-ink-secondary hover:bg-bg-hover"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!canDownload}
            className="rounded bg-success/20 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? 'กำลังสร้างไฟล์…' : '⬇️ ดาวน์โหลด .xlsx'}
          </button>
        </div>
      </div>
    </div>
  );
}
