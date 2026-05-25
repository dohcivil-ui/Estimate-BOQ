/**
 * Modal: รายการโปรเจกต์ — เปิด / ลบ (admin) / ส่งคำขอลบ (user)
 */
import { useEffect, useState } from 'react';
import {
  deleteProject,
  listProjects,
  loadProject,
  requestDeleteProject,
  type LoadProgress,
  type ProjectListItem,
} from '@/services/projectSync';
import { useCurrentProject } from '@/stores/currentProjectStore';
import { useIsAdmin } from '@/stores/authStore';

interface Props {
  onClose: () => void;
}

export function ProjectListModal({ onClose }: Props) {
  const [items, setItems] = useState<ProjectListItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyOpenId, setBusyOpenId] = useState<string | null>(null);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const dirty = useCurrentProject((s) => s.dirty);
  const isAdmin = useIsAdmin();

  useEffect(() => {
    void (async () => {
      try {
        setItems(await listProjects());
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const handleOpen = async (id: string) => {
    if (dirty) {
      if (!confirm('มีงานที่ยังไม่บันทึก — เปิดโปรเจกต์อื่นจะสูญหาย ดำเนินการต่อ?')) {
        return;
      }
    }
    setBusyOpenId(id);
    setErr(null);
    try {
      await loadProject(id, (p) => setProgress(p));
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyOpenId(null);
      setProgress(null);
    }
  };

  const handleDelete = async (item: ProjectListItem) => {
    if (isAdmin) {
      if (!confirm(`ลบ "${item.name}" และทุก data ของโปรเจกต์? (ไม่สามารถกู้คืน)`)) return;
      try {
        await deleteProject(item.id);
        setItems((items) => (items ?? []).filter((x) => x.id !== item.id));
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    } else {
      const reason = prompt(`ส่งคำขอลบ "${item.name}" — ระบุเหตุผล:`, '');
      if (reason === null) return;
      try {
        await requestDeleteProject(item.id, reason);
        alert('ส่งคำขอลบเรียบร้อย รอ admin อนุมัติ');
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg border border-bg-border bg-bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-bg-border p-4">
          <h3 className="text-base font-semibold text-ink-primary">
            📋 รายการโปรเจกต์
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
            <div className="mb-3 rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
              {err}
            </div>
          )}

          {items === null && (
            <p className="text-center text-xs text-ink-muted">กำลังโหลด…</p>
          )}

          {items && items.length === 0 && (
            <div className="rounded border border-dashed border-bg-border p-6 text-center text-xs text-ink-muted">
              ยังไม่มีโปรเจกต์ — เริ่มทำงานแล้วกด "💾 บันทึก" เพื่อสร้าง
            </div>
          )}

          {items && items.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
                <tr className="border-b border-bg-border">
                  <th className="py-2 text-left">ชื่อ</th>
                  <th className="py-2 text-left">เจ้าของ/จังหวัด</th>
                  <th className="py-2 text-left">บันทึกล่าสุด</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr
                    key={it.id}
                    className="border-b border-bg-border hover:bg-bg-hover"
                  >
                    <td className="py-2 text-ink-primary">{it.name}</td>
                    <td className="py-2 text-xs text-ink-secondary">
                      {[it.client, it.province].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="py-2 text-xs text-ink-secondary">
                      {new Date(it.updated_at).toLocaleString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpen(it.id)}
                          disabled={busyOpenId !== null}
                          className="rounded bg-accent/20 px-2 py-1 text-xs text-accent hover:bg-accent/30 disabled:opacity-50"
                        >
                          {busyOpenId === it.id ? '⌛' : '📂 เปิด'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(it)}
                          className="rounded px-2 py-1 text-xs text-ink-muted hover:bg-danger/10 hover:text-danger"
                          title={isAdmin ? 'ลบ' : 'ส่งคำขอลบให้ admin'}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {progress && progress.step !== 'done' && (
            <div className="mt-4 rounded border border-bg-border bg-bg-raised p-3 text-xs text-ink-secondary">
              <p>กำลังโหลดโปรเจกต์…</p>
              <p className="mt-1 font-mono text-[10px] text-ink-muted">
                {progress.step}
                {progress.fileName ? ` · ${progress.fileName}` : ''}
                {progress.fileCurrent
                  ? ` · ${progress.fileCurrent}/${progress.fileTotal}`
                  : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
