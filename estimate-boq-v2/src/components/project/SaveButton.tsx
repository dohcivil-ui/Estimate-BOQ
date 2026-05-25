/**
 * ปุ่ม "💾 บันทึก" ใน TopBar
 */
import { useState } from 'react';
import { useCurrentProject } from '@/stores/currentProjectStore';
import { useProjectMeta } from '@/stores/projectMetaStore';
import { saveProject } from '@/services/projectSync';
import { isAuthBypassed } from '@/stores/authStore';
import { isSupabaseConfigured } from '@/lib/supabase';

export function SaveButton() {
  const dirty = useCurrentProject((s) => s.dirty);
  const projectId = useCurrentProject((s) => s.projectId);
  const lastSaved = useCurrentProject((s) => s.lastSavedAt);
  const name = useProjectMeta((s) => s.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      setErr(e instanceof Error ? e.message : String(e));
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
      {err && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded border border-danger/40 bg-bg-panel p-2 text-xs text-danger shadow-xl">
          {err}
          <button
            type="button"
            onClick={() => setErr(null)}
            className="ml-2 text-ink-muted hover:text-ink-primary"
          >
            ✕
          </button>
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
