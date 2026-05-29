/**
 * Modal: paste JSON จาก Custom GPT → import เข้า BOQ
 */
import { useEffect, useRef, useState } from 'react';
import {
  parseAIPayload,
  payloadToBOQItems,
  AIImportError,
} from '@/services/aiImport';
import { useBOQStore } from '@/stores/boqStore';
import { useProjectMeta } from '@/stores/projectMetaStore';

interface Props {
  onClose: () => void;
}

export function AIImportModal({ onClose }: Props) {
  const [raw, setRaw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  const handleImport = () => {
    setErr(null);
    setOkMsg(null);
    try {
      const payload = parseAIPayload(raw);
      const items = payloadToBOQItems(payload);
      useBOQStore.getState().addMany(items);

      // ❌ ไม่ apply factorF จาก JSON — Factor F ต้อง auto-lookup ตาราง CGD เสมอ
      // (GPT ตอนถอดแบบยังไม่รู้ยอดค่างาน ค่าที่ส่งมาเป็นการเดา จะกลบ auto)
      // apply project name ถ้ามี (ไม่ทับชื่อปัจจุบันถ้า user ตั้งไว้แล้ว)
      const meta = useProjectMeta.getState();
      if (payload.project && !meta.name) {
        useProjectMeta.getState().setField('name', payload.project);
      }

      setOkMsg(`✓ นำเข้า ${items.length} รายการเรียบร้อย`);
      setTimeout(onClose, 800);
    } catch (e) {
      setErr(
        e instanceof AIImportError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e),
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-bg-border bg-bg-panel p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink-primary">
            🤖 นำเข้า BOQ จาก AI (Custom GPT)
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
          วาง JSON ที่ได้จาก Custom GPT (สั่ง <b>&quot;ส่งออก JSON&quot;</b>) แล้วกดนำเข้า
          <br />
          <span className="text-ink-muted">
            รูปแบบ:{' '}
            <code className="rounded bg-bg-raised px-1">
              {`{"project":"...","factorF":1.3,"boq":[{"name":"...","unit":"ตัน","rate":3900,"qty":0.38,"isMat":false,"waste":7}]}`}
            </code>
          </span>
        </p>

        <textarea
          ref={taRef}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder='วาง JSON ที่นี่ — จะ strip code-fence ``` อัตโนมัติ'
          rows={14}
          className="w-full rounded border border-bg-border bg-bg-base p-2 font-mono text-xs text-ink-primary outline-none focus:border-accent"
        />

        {err && (
          <div className="mt-2 rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
            {err}
          </div>
        )}
        {okMsg && (
          <div className="mt-2 rounded border border-success/40 bg-success/10 p-2 text-xs text-success">
            {okMsg}
          </div>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRaw('')}
            className="rounded border border-bg-border bg-bg-raised px-3 py-1.5 text-sm text-ink-secondary hover:bg-bg-hover"
          >
            🗑️ ล้าง
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-bg-border bg-bg-raised px-3 py-1.5 text-sm text-ink-secondary hover:bg-bg-hover"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleImport}
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-ink-inverse hover:bg-accent-hover"
          >
            ✅ นำเข้า
          </button>
        </div>
      </div>
    </div>
  );
}
