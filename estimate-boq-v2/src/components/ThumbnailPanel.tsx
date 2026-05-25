import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useActivePageId,
  useDrawingFiles,
  useDrawingStore,
} from '@/stores/drawingStore';
import type { DrawingPage } from '@/types/drawing';

export function ThumbnailPanel() {
  const files = useDrawingFiles();
  const allPages = useDrawingStore((s) => s.pages);
  const activeId = useActivePageId();
  const setActivePage = useDrawingStore((s) => s.setActivePage);
  const removeFile = useDrawingStore((s) => s.removeFile);

  const totalPages = allPages.length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-bg-border px-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
          หน้าแบบ
        </h2>
        <span className="text-xs text-ink-muted">
          {totalPages > 0 ? `${totalPages} หน้า · ${files.length} ไฟล์` : '0 หน้า'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-1 p-2">
            {files.map((file) => (
              <FileGroup
                key={file.id}
                fileId={file.id}
                fileName={file.name}
                pageCount={file.pageCount}
                onRemove={() => {
                  if (confirm(`ลบไฟล์ "${file.name}" และทุกหน้า?`)) {
                    removeFile(file.id);
                  }
                }}
                activePageId={activeId}
                onPick={setActivePage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-3 text-center">
      <div className="mb-2 text-3xl opacity-30">📄</div>
      <p className="text-xs leading-relaxed text-ink-muted">
        ยังไม่มีแบบ
        <br />
        กด{' '}
        <span className="text-ink-secondary">เปิดแบบ PDF/JPG</span>
        <br />
        ด้านบน หรือ
        <br />
        <span className="text-ink-secondary">ลากไฟล์มาวาง</span>
      </p>
    </div>
  );
}

function FileGroup({
  fileId,
  fileName,
  pageCount,
  onRemove,
  activePageId,
  onPick,
}: {
  fileId: string;
  fileName: string;
  pageCount: number;
  onRemove: () => void;
  activePageId: string | null;
  onPick: (pageId: string) => void;
}) {
  const pages = useDrawingStore((s) =>
    s.pages
      .filter((p) => p.fileId === fileId)
      .sort((a, b) => a.pageNumber - b.pageNumber),
  );

  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded border border-bg-border bg-bg-raised">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="text-ink-muted hover:text-ink-primary"
          aria-label={collapsed ? 'ขยาย' : 'ย่อ'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <span
          className="flex-1 truncate text-xs font-medium text-ink-primary"
          title={fileName}
        >
          {fileName}
        </span>
        <span className="text-[10px] text-ink-muted">{pageCount}น.</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-ink-muted hover:text-danger"
          aria-label="ลบไฟล์"
          title="ลบไฟล์"
        >
          ✕
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-1 p-1.5">
          {pages.map((page) => (
            <ThumbnailItem
              key={page.id}
              page={page}
              isActive={page.id === activePageId}
              onPick={() => onPick(page.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ThumbnailItem({
  page,
  isActive,
  onPick,
}: {
  page: DrawingPage;
  isActive: boolean;
  onPick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const visible = useIntersection(ref);

  // คงสัดส่วนภาพต้นฉบับเพื่อ thumbnail ไม่บิด
  const ratio = page.pageHeight / Math.max(1, page.pageWidth);
  const thumbHeight = useMemo(() => Math.round(150 * ratio), [ratio]);

  // เลื่อน scroll ไปยัง thumbnail ที่ active เพื่อให้เห็นเสมอ
  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isActive]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onPick}
      className={`flex w-full flex-col items-center gap-1 rounded border p-1.5 text-xs transition-colors ${
        isActive
          ? 'border-accent bg-accent-subtle/40 text-ink-primary'
          : 'border-bg-border bg-bg-panel text-ink-secondary hover:border-ink-muted hover:bg-bg-hover'
      }`}
    >
      <div
        className="relative w-full overflow-hidden rounded bg-bg-base"
        style={{ height: thumbHeight }}
      >
        {visible && page.thumbnailDataUrl ? (
          <img
            src={page.thumbnailDataUrl}
            alt={`หน้า ${page.pageNumber}`}
            className="h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-muted">
            <span className="text-[10px]">…</span>
          </div>
        )}
      </div>
      <div className="flex w-full items-center justify-between text-[10px]">
        <span>หน้า {page.pageNumber}</span>
        {isActive && <span className="text-accent">●</span>}
      </div>
    </button>
  );
}

/** lazy-render hook ด้วย IntersectionObserver — เปิด <img> เฉพาะตอนเห็น */
function useIntersection(
  ref: React.RefObject<HTMLElement | null>,
): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (visible) return; // เห็นครั้งเดียวพอ ไม่ต้อง unload

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            return;
          }
        }
      },
      { rootMargin: '200px' }, // โหลดล่วงหน้าก่อน scroll ถึง
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, visible]);

  return visible;
}
