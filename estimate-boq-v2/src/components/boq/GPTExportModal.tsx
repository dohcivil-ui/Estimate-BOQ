/**
 * Modal: แสดงข้อความสรุปค่าวัด + ปุ่มคัดลอก สำหรับส่งให้ Custom GPT
 */
import { useEffect, useMemo, useState } from 'react';
import { useMeasurementStore } from '@/stores/measurementStore';
import { useProjectMeta } from '@/stores/projectMetaStore';
import { buildGPTPrompt, copyToClipboard } from '@/services/gptExport';

interface Props {
  onClose: () => void;
}

export function GPTExportModal({ onClose }: Props) {
  const allMeasurements = useMeasurementStore((s) => s.measurements);
  const meta = useProjectMeta();
  const [copied, setCopied] = useState(false);

  const text = useMemo(
    () => buildGPTPrompt(allMeasurements, meta),
    [allMeasurements, meta],
  );

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(t);
    }
  }, [copied]);

  const handleCopy = async () => {
    try {
      await copyToClipboard(text);
      setCopied(true);
    } catch (err) {
      alert(`คัดลอกไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-bg-border bg-bg-panel p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink-primary">
            📋 ส่งค่าวัดไปให้ Custom GPT
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
        <p className="mb-2 text-xs text-ink-secondary">
          คัดลอกข้อความด้านล่างไปวางใน Custom GPT แล้วสั่ง <b>&quot;ส่งออก JSON&quot;</b>
          จากนั้นนำ JSON ที่ได้กลับมา <b>นำเข้า</b> ในแท็บ BOQ
        </p>

        <textarea
          value={text}
          readOnly
          rows={16}
          className="w-full rounded border border-bg-border bg-bg-base p-2 font-mono text-xs text-ink-primary outline-none"
        />

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-bg-border bg-bg-raised px-3 py-1.5 text-sm text-ink-secondary hover:bg-bg-hover"
          >
            ปิด
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-ink-inverse hover:bg-accent-hover"
          >
            {copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกข้อความ'}
          </button>
        </div>
      </div>
    </div>
  );
}
