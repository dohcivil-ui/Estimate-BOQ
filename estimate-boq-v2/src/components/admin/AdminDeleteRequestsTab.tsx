/**
 * Admin tab — list delete requests + approve/reject
 */
import { useCallback, useEffect, useState } from 'react';
import {
  approveDeleteRequest,
  listDeleteRequests,
  rejectDeleteRequest,
  type AdminDeleteRequest,
  type DeleteRequestStatus,
} from '@/services/adminApi';

const STATUS_LABEL: Record<DeleteRequestStatus, { text: string; color: string }> =
  {
    pending: { text: 'รอตรวจ', color: 'text-warning' },
    approved: { text: 'อนุมัติแล้ว', color: 'text-success' },
    rejected: { text: 'ปฏิเสธ', color: 'text-danger' },
  };

const TYPE_LABEL: Record<string, string> = {
  project: 'โปรเจกต์',
  drawing_page: 'หน้าแบบ',
  shape: 'ค่าวัด',
  boq_item: 'BOQ',
};

export function AdminDeleteRequestsTab() {
  const [items, setItems] = useState<AdminDeleteRequest[] | null>(null);
  const [filter, setFilter] = useState<DeleteRequestStatus | 'all'>('pending');
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listDeleteRequests(
        filter === 'all' ? undefined : filter,
      );
      setItems(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleApprove = async (req: AdminDeleteRequest) => {
    if (
      !confirm(
        `อนุมัติลบ ${TYPE_LABEL[req.item_type]} (id: ${req.item_id.slice(0, 8)}…)?`,
      )
    )
      return;
    setBusyId(req.id);
    setErr(null);
    try {
      await approveDeleteRequest(req);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req: AdminDeleteRequest) => {
    const reason = prompt('เหตุผลในการปฏิเสธ (optional):', '');
    if (reason === null) return;
    setBusyId(req.id);
    setErr(null);
    try {
      await rejectDeleteRequest(req.id, reason || undefined);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-muted">แสดง:</span>
        {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded px-2 py-0.5 text-xs ${
              filter === s
                ? 'bg-accent text-ink-inverse'
                : 'text-ink-secondary hover:bg-bg-hover'
            }`}
          >
            {s === 'all' ? 'ทั้งหมด' : STATUS_LABEL[s].text}
          </button>
        ))}
        <button
          type="button"
          onClick={refresh}
          className="ml-auto rounded px-2 py-0.5 text-xs text-ink-muted hover:text-ink-primary"
        >
          ↻ refresh
        </button>
      </div>

      {err && (
        <div className="rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
          {err}
        </div>
      )}

      {items === null ? (
        <p className="text-center text-xs text-ink-muted">กำลังโหลด…</p>
      ) : items.length === 0 ? (
        <p className="rounded border border-dashed border-bg-border p-6 text-center text-xs text-ink-muted">
          ไม่มีคำขอ
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
            <tr className="border-b border-bg-border">
              <th className="py-2 text-left">ผู้ขอ</th>
              <th className="py-2 text-left">ชนิด</th>
              <th className="py-2 text-left">เหตุผล</th>
              <th className="py-2 text-left">วันที่</th>
              <th className="py-2 text-left">สถานะ</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((req) => {
              const stt = STATUS_LABEL[req.status];
              const isPending = req.status === 'pending';
              return (
                <tr
                  key={req.id}
                  className="border-b border-bg-border hover:bg-bg-hover"
                >
                  <td className="py-2 text-xs text-ink-primary">
                    {req.requester_name || req.requester_email || req.requester_id.slice(0, 8) + '…'}
                  </td>
                  <td className="py-2 text-xs text-ink-secondary">
                    {TYPE_LABEL[req.item_type] ?? req.item_type}
                    <div className="font-mono text-[10px] text-ink-muted">
                      {req.item_id.slice(0, 8)}…
                    </div>
                  </td>
                  <td className="max-w-xs py-2 text-xs text-ink-secondary">
                    {req.reason || <span className="text-ink-muted">—</span>}
                  </td>
                  <td className="py-2 text-xs text-ink-secondary">
                    {new Date(req.created_at).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className={`py-2 text-xs ${stt.color}`}>{stt.text}</td>
                  <td className="py-2 text-right">
                    {isPending && (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleApprove(req)}
                          disabled={busyId === req.id}
                          className="rounded bg-success/20 px-2 py-1 text-xs text-success hover:bg-success/30 disabled:opacity-50"
                        >
                          ✓ อนุมัติ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(req)}
                          disabled={busyId === req.id}
                          className="rounded bg-danger/20 px-2 py-1 text-xs text-danger hover:bg-danger/30 disabled:opacity-50"
                        >
                          ✕ ปฏิเสธ
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
