/**
 * Admin tab — list users + change role
 */
import { useEffect, useState } from 'react';
import {
  listUsers,
  setUserRole,
  type AdminUserItem,
} from '@/services/adminApi';
import { useCurrentUser } from '@/stores/authStore';
import type { UserRole } from '@/types/user';

export function AdminUsersTab() {
  const [users, setUsers] = useState<AdminUserItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const me = useCurrentUser();

  const refresh = async () => {
    try {
      setUsers(await listUsers());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleRoleChange = async (u: AdminUserItem, next: UserRole) => {
    if (u.id === me?.id && next !== 'admin') {
      alert('ห้ามถอด admin ของตัวเอง — ใช้ admin คนอื่นเปลี่ยนให้');
      return;
    }
    setSavingId(u.id);
    setErr(null);
    try {
      await setUserRole(u.id, next);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingId(null);
    }
  };

  if (users === null) {
    return <p className="text-center text-xs text-ink-muted">กำลังโหลด…</p>;
  }

  return (
    <div className="space-y-3">
      {err && (
        <div className="rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
          {err}
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
          <tr className="border-b border-bg-border">
            <th className="py-2 text-left">ชื่อ / อีเมล</th>
            <th className="w-32 py-2 text-left">role</th>
            <th className="w-32 py-2 text-left">สมัครเมื่อ</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr
              key={u.id}
              className="border-b border-bg-border hover:bg-bg-hover"
            >
              <td className="py-2">
                <div className="flex items-center gap-2">
                  {u.avatar_url ? (
                    <img
                      src={u.avatar_url}
                      alt=""
                      className="h-7 w-7 rounded-full bg-bg-base object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-subtle text-[11px] font-semibold text-accent">
                      {(u.full_name || u.email).slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="leading-tight">
                    <div className="text-ink-primary">
                      {u.full_name || '—'}
                      {u.id === me?.id && (
                        <span className="ml-1 text-[10px] text-ink-muted">(คุณ)</span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-secondary">
                      {u.email}
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-2">
                <select
                  value={u.role}
                  disabled={savingId === u.id}
                  onChange={(e) =>
                    handleRoleChange(u, e.target.value as UserRole)
                  }
                  className={`rounded border bg-bg-base px-2 py-1 text-xs outline-none ${
                    u.role === 'admin'
                      ? 'border-accent text-accent'
                      : 'border-bg-border text-ink-secondary'
                  }`}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td className="py-2 text-xs text-ink-secondary">
                {new Date(u.created_at).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
