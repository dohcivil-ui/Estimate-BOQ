/**
 * Modal: เลือกหน้าอ้างอิง — แสดง thumbnail ทุกหน้า, click toggle
 */
import { useEffect, useMemo } from 'react';
import { useDrawingFiles, useDrawingStore } from '@/stores/drawingStore';
import { useAIReferenceStore } from '@/stores/aiReferenceStore';

interface Props {
  onClose: () => void;
}

export function RefPageSelector({ onClose }: Props) {
  const allPages = useDrawingStore((s) => s.pages);
  const files = useDrawingFiles();
  const refIds = useAIReferenceStore((s) => s.pageIds);
  const toggle = useAIReferenceStore((s) => s.toggle);
  const clear = useAIReferenceStore((s) => s.clear);
  const pruneInvalid = useAIReferenceStore((s) => s.pruneInvalid);
  const maxRef = useAIReferenceStore((s) => s.maxPages);

  const validPageIds = useMemo(() => allPages.map((p) => p.id), [allPages]);
  const validRefIds = useMemo(
    () => refIds.filter((id) => validPageIds.includes(id)),
    [refIds, validPageIds],
  );

  // กัน localStorage ค้างจาก PDF/project เก่า ทำให้ refIds เต็ม 3 แต่ไม่มีหน้าไหน selected จริง
  useEffect(() => {
    pruneInvalid(validPageIds);
  }, [pruneInvalid, validPageIds]);

  /** group pages by file */
  const grouped = useMemo(() => {
    const map = new Map<string, typeof allPages>();
    for (const p of allPages) {
      const list = map.get(p.fileId) ?? [];
      list.push(p);
      map.set(p.fileId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.pageNumber - b.pageNumber);
    }
    return Array.from(map.entries()).map(([fileId, pages]) => ({
      fileId,
      file: files.find((f) => f.id === fileId),
      pages,
    }));
  }, [allPages, files]);

  if (allPages.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-lg border border-bg-border bg-bg-panel p-5 text-center">
          <p className="mb-4 text-sm text-ink-secondary">
            ยังไม่มีแบบเปิดอยู่ — เปิด PDF/JPG ก่อน
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-bg-border bg-bg-raised px-3 py-1.5 text-sm text-ink-primary hover:bg-bg-hover"
          >
            ปิด
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-lg border border-bg-border bg-bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-bg-border p-4">
          <div>
            <h3 className="text-base font-semibold text-ink-primary">
              📋 เลือกหน้าอ้างอิง
            </h3>
            <p className="text-[11px] text-ink-secondary">
              หน้าที่เลือกจะถูกส่งให้ AI ก่อนภาพหลัก — แนะนำหน้า "รายการวัสดุ/สัญลักษณ์"
              ({validRefIds.length}/{maxRef} หน้า)
            </p>
          </div>
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
          {grouped.map(({ fileId, file, pages }) => (
            <div key={fileId} className="mb-4">
              <h4 className="mb-2 text-xs font-semibold text-ink-secondary">
                📁 {file?.name ?? fileId}
              </h4>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                {pages.map((page) => {
                  const isRef = validRefIds.includes(page.id);
                  const ratio = page.pageHeight / Math.max(1, page.pageWidth);
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => toggle(page.id)}
                      disabled={!isRef && validRefIds.length >= maxRef}
                      className={`flex flex-col gap-1 rounded border p-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        isRef
                          ? 'border-accent bg-accent-subtle/40 text-ink-primary'
                          : 'border-bg-border bg-bg-raised text-ink-secondary hover:border-ink-muted hover:bg-bg-hover'
                      }`}
                    >
                      <div
                        className="relative w-full overflow-hidden rounded bg-bg-base"
                        style={{ paddingBottom: `${ratio * 100}%` }}
                      >
                        {page.thumbnailDataUrl && (
                          <img
                            src={page.thumbnailDataUrl}
                            alt={`หน้า ${page.pageNumber}`}
                            className="absolute inset-0 h-full w-full object-contain"
                            draggable={false}
                          />
                        )}
                        {isRef && (
                          <div className="absolute right-1 top-1 rounded-full bg-accent px-1 text-[10px] text-ink-inverse">
                            ✓
                          </div>
                        )}
                      </div>
                      <div className="text-[10px]">หน้า {page.pageNumber}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-bg-border p-3">
          <button
            type="button"
            onClick={clear}
            disabled={validRefIds.length === 0}
            className="text-xs text-ink-muted hover:text-danger disabled:opacity-30"
          >
            🗑️ ล้างทั้งหมด
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-ink-inverse hover:bg-accent-hover"
          >
            ✅ เสร็จ ({validRefIds.length})
          </button>
        </div>
      </div>
    </div>
  );
}
