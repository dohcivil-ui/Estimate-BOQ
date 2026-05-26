/**
 * ปุ่ม "💾 บันทึก" ใน TopBar
 */
import { useState } from 'react';
import { useCurrentProject } from '@/stores/currentProjectStore';
import { useProjectMeta } from '@/stores/projectMetaStore';
import { RLSError, saveProject } from '@/services/projectSync';
import { isAuthBypassed } from '@/stores/authStore';
import { isSupabaseConfigured } from '@/lib/supabase';

export function SaveButton() {
  const dirty = useCurrentProject((s) => s.dirty);
  const projectId = useCurrentProject((s) => s.projectId);
  const lastSaved = useCurrentProject((s) => s.lastSavedAt);
  const name = useProjectMeta((s) => s.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);

  const disabled =
    !isSupabaseConfigured() || isAuthBypassed() || busy;

  const handleSave = async () => {
    if (!name.trim()) {
      alert('กรุณาตั้งชื่อโครงการก่อนบันทึก (แท็บ BOQ → ข้อมูลโครงการ)');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await saveProject();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      setErr(error);
      console.error('[save] failed:', error);
    } finally {
      setBusy(false);
    }
  };

  const title = isAuthBypassed()
    ? 'อยู่ใน dev-bypass mode — ปิด VITE_DEV_BYPASS_AUTH แล้ว login จริงเพื่อบันทึก'
    : !isSupabaseConfigured()
      ? 'ยังไม่ได้ตั้ง Supabase — ตั้ง .env.local'
      : dirty
        ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก'
        : projectId
          ? `บันทึกล่าสุด: ${formatTime(lastSaved)}`
          : 'ยังไม่ได้บันทึก';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleSave}
        disabled={disabled}
        title={title}
        className={`rounded border px-2.5 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          dirty
            ? 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
            : 'border-bg-border bg-bg-raised text-ink-primary hover:bg-bg-hover'
        }`}
      >
        {busy ? '⌛ บันทึก…' : dirty ? '💾 บันทึก•' : '💾 บันทึก'}
      </button>
      {err && <SaveErrorPopover error={err} onClose={() => setErr(null)} />}
    </div>
  );
}

function SaveErrorPopover({
  error,
  onClose,
}: {
  error: Error;
  onClose: () => void;
}) {
  const isRls = error instanceof RLSError;
  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-96 rounded border border-danger/40 bg-bg-panel p-3 text-xs shadow-xl">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-semibold text-danger">
          {isRls ? '🔒 RLS Policy บล็อกการบันทึก' : '⚠️ บันทึกไม่สำเร็จ'}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 text-ink-muted hover:text-ink-primary"
          aria-label="ปิด"
        >
          ✕
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-ink-secondary">
        {error.message}
      </pre>
      {isRls && (
        <div className="mt-2 space-y-1 border-t border-bg-border pt-2 text-[11px] text-ink-muted">
          <p className="font-semibold text-ink-primary">วิธีแก้ (ทำตามลำดับ):</p>
          <ol className="list-decimal space-y-0.5 pl-4">
            <li>
              เปิดไฟล์{' '}
              <code className="rounded bg-bg-raised px-1">
                supabase/fix-rls-policies.sql
              </code>
            </li>
            <li>
              ไปที่ Supabase Dashboard → SQL Editor → New query
            </li>
            <li>Copy เนื้อหา SQL ทั้งหมด → paste → กด Run</li>
            <li>กลับมาที่นี่แล้วกด 💾 บันทึก อีกครั้ง</li>
          </ol>
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
