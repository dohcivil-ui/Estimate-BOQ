/**
 * แสดงรายการหน้าอ้างอิงที่เลือก + ปุ่มเปิด RefPageSelector
 */
import { useEffect, useMemo, useState } from 'react';
import { useDrawingFiles, useDrawingStore } from '@/stores/drawingStore';
import { useAIReferenceStore } from '@/stores/aiReferenceStore';
import { RefPageSelector } from './RefPageSelector';

export function RefPagesBlock() {
  const refIds = useAIReferenceStore((s) => s.pageIds);
  const remove = useAIReferenceStore((s) => s.remove);
  const pruneInvalid = useAIReferenceStore((s) => s.pruneInvalid);
  const allPages = useDrawingStore((s) => s.pages);
  const files = useDrawingFiles();
  const [showSelector, setShowSelector] = useState(false);

  const validPageIds = useMemo(() => allPages.map((p) => p.id), [allPages]);

  // prune ghost refs จาก localStorage เมื่อเปิด PDF/project ใหม่
  useEffect(() => {
    pruneInvalid(validPageIds);
  }, [pruneInvalid, validPageIds]);

  const selected = useMemo(
    () =>
      refIds
        .map((id) => {
          const p = allPages.find((x) => x.id === id);
          if (!p) return null;
          const f = files.find((x) => x.id === p.fileId);
          return {
            id: p.id,
            pageNumber: p.pageNumber,
            label: f ? f.name : '—',
          };
        })
        .filter((x): x is { id: string; pageNumber: number; label: string } => x !== null),
    [refIds, allPages, files],
  );

  const totalPagesInProject = allPages.length;

  return (
    <div className="rounded border border-bg-border bg-bg-raised p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <h4 className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
          📋 หน้าอ้างอิง
          {selected.length > 0 && (
            <span className="rounded-full bg-accent-subtle px-1.5 text-[10px] text-accent">
              {selected.length}/4
            </span>
          )}
        </h4>
        <button
          type="button"
          onClick={() => setShowSelector(true)}
          disabled={totalPagesInProject === 0}
          className="rounded border border-bg-border bg-bg-panel px-2 py-0.5 text-[10px] text-ink-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selected.length === 0 ? '＋ เพิ่ม' : '✎ แก้ไข'}
        </button>
      </div>

      {selected.length === 0 ? (
        <p className="text-[10px] leading-relaxed text-ink-muted">
          เลือกหน้า "รายการวัสดุ/สัญลักษณ์" เป็นอ้างอิง —
          AI จะอ่านก่อนวิเคราะห์ → ไม่เดาวัสดุผิด
        </p>
      ) : (
        <ul className="space-y-1">
          {selected.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-1.5 rounded bg-bg-panel px-2 py-1 text-[11px]"
            >
              <span className="text-accent">📄</span>
              <span className="font-semibold text-ink-primary">
                หน้า {p.pageNumber}
              </span>
              <span className="truncate text-ink-secondary" title={p.label}>
                — {p.label}
              </span>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="ml-auto text-ink-muted hover:text-danger"
                aria-label="ลบ"
                title="เอาออก"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {showSelector && <RefPageSelector onClose={() => setShowSelector(false)} />}
    </div>
  );
}
