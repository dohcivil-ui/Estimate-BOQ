import { useEffect, useRef, useState } from 'react';
import { signOut } from '@/lib/supabase';
import { useCurrentUser } from '@/stores/authStore';
import { AdminPanel } from './admin/AdminPanel';

export function UserMenu() {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!user) return null;

  const initials = (user.profile.full_name || user.email)
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isAdmin = user.profile.role === 'admin';

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('[auth] signOut error:', err);
      setSigningOut(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded border border-bg-border bg-bg-raised px-2 py-1 text-sm transition-colors hover:bg-bg-hover"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar
          src={user.profile.avatar_url}
          initials={initials}
        />
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-xs text-ink-primary">
            {user.profile.full_name || user.email}
          </span>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider ${
              isAdmin ? 'text-accent' : 'text-ink-muted'
            }`}
          >
            {user.profile.role}
          </span>
        </div>
        <svg
          className="h-3 w-3 text-ink-muted"
          viewBox="0 0 12 12"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M6 8L2 4h8z" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-md border border-bg-border bg-bg-panel shadow-xl"
          role="menu"
        >
          <div className="border-b border-bg-border bg-bg-raised p-3">
            <p className="truncate text-xs font-medium text-ink-primary">
              {user.profile.full_name || '—'}
            </p>
            <p className="truncate text-[11px] text-ink-muted">{user.email}</p>
          </div>

          <div className="py-1 text-sm">
            {isAdmin && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowAdmin(true);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-ink-primary transition-colors hover:bg-bg-hover"
              >
                <span>🛡️</span>
                <span>Admin Panel</span>
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-ink-primary transition-colors hover:bg-bg-hover disabled:opacity-60"
            >
              <span>🚪</span>
              <span>{signingOut ? 'กำลังออก…' : 'ออกจากระบบ'}</span>
            </button>
          </div>
        </div>
      )}

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  );
}

function Avatar({
  src,
  initials,
}: {
  src: string | null;
  initials: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="h-7 w-7 rounded-full bg-bg-base object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-subtle text-[11px] font-semibold text-accent">
      {initials || '?'}
    </div>
  );
}
