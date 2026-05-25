/**
 * Admin Panel modal — 3 tabs: Users / Delete Requests / Material Prices
 * เปิดเฉพาะ admin (UserMenu ตรวจ role ก่อนแสดงปุ่ม)
 */
import { useState } from 'react';
import { AdminUsersTab } from './AdminUsersTab';
import { AdminDeleteRequestsTab } from './AdminDeleteRequestsTab';
import { AdminMaterialPricesTab } from './AdminMaterialPricesTab';

type AdminTab = 'users' | 'requests' | 'prices';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'users', label: '👥 ผู้ใช้' },
  { id: 'requests', label: '🗑️ คำขอลบ' },
  { id: 'prices', label: '💰 ราคาวัสดุ' },
];

interface Props {
  onClose: () => void;
}

export function AdminPanel({ onClose }: Props) {
  const [tab, setTab] = useState<AdminTab>('users');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-5xl flex-col rounded-lg border border-bg-border bg-bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-bg-border p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-primary">
            <span>🛡️</span>
            <span>Admin Panel</span>
            <span className="ml-2 text-xs font-normal text-ink-muted">
              จัดการระบบ
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl text-ink-muted hover:text-ink-primary"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="flex shrink-0 border-b border-bg-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-b-2 border-accent bg-bg-raised text-ink-primary'
                  : 'border-b-2 border-transparent text-ink-secondary hover:bg-bg-hover'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'users' && <AdminUsersTab />}
          {tab === 'requests' && <AdminDeleteRequestsTab />}
          {tab === 'prices' && <AdminMaterialPricesTab />}
        </div>
      </div>
    </div>
  );
}
