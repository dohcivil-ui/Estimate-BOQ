import { useState } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useActivePage, useDrawingStore } from '@/stores/drawingStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useCanvasSize } from '@/stores/canvasSizeStore';
import { useUIStore } from '@/stores/uiStore';
import { isAuthBypassed } from '@/stores/authStore';
import { FileImportButton } from './FileImportButton';
import { UserMenu } from './UserMenu';
import { SaveButton } from './project/SaveButton';
import { ProjectListModal } from './project/ProjectListModal';

export function TopBar() {
  const supabaseOk = isSupabaseConfigured();
  const bypassed = isAuthBypassed();
  const totalPages = useDrawingStore((s) => s.pages.length);
  const page = useActivePage();
  const { width: cw, height: ch } = useCanvasSize();
  const zoomAt = useViewportStore((s) => s.zoomAt);
  const fit = useViewportStore((s) => s.fit);
  const [showProjectList, setShowProjectList] = useState(false);

  const handleZoomIn = () => {
    if (!page || cw === 0 || ch === 0) return;
    zoomAt(page.id, 1.25, cw / 2, ch / 2);
  };
  const handleZoomOut = () => {
    if (!page || cw === 0 || ch === 0) return;
    zoomAt(page.id, 0.8, cw / 2, ch / 2);
  };
  const handleFit = () => {
    if (!page || cw === 0 || ch === 0) return;
    fit(page.id, cw, ch, page.pageWidth, page.pageHeight);
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-bg-border bg-bg-panel px-4">
      <div className="flex items-center gap-3">
        <span className="text-base font-semibold text-ink-primary">
          Estimate-BOQ
        </span>
        <span className="rounded bg-accent-subtle px-2 py-0.5 text-xs font-medium text-accent">
          v2 · AI-first
        </span>
        <span
          className={`ml-1 inline-flex items-center gap-1.5 text-[11px] ${
            supabaseOk ? 'text-success' : 'text-warning'
          }`}
          title={
            supabaseOk
              ? 'เชื่อมต่อ Supabase แล้ว'
              : 'ยังไม่ได้ตั้ง .env.local'
          }
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              supabaseOk ? 'bg-success' : 'bg-warning'
            }`}
          />
          {supabaseOk ? 'connected' : 'not configured'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {totalPages > 0 && page && (
          <div className="flex items-center gap-1 rounded border border-bg-border bg-bg-raised px-1 py-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              className="px-2 py-0.5 text-sm text-ink-secondary hover:text-ink-primary"
              title="Zoom out (ล้อเมาส์ลง)"
            >
              −
            </button>
            <button
              type="button"
              onClick={handleFit}
              className="px-2 py-0.5 text-xs text-ink-secondary hover:text-ink-primary"
              title="Fit (F หรือ 0)"
            >
              ⤢
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="px-2 py-0.5 text-sm text-ink-secondary hover:text-ink-primary"
              title="Zoom in (ล้อเมาส์ขึ้น)"
            >
              +
            </button>
          </div>
        )}
        <FileImportButton />
        <button
          type="button"
          onClick={() => setShowProjectList(true)}
          disabled={!supabaseOk || bypassed}
          className="rounded border border-bg-border bg-bg-raised px-2.5 py-1.5 text-sm text-ink-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          title={
            bypassed
              ? 'อยู่ใน dev-bypass mode — ปิดเพื่อใช้ cloud project'
              : !supabaseOk
                ? 'ยังไม่ได้ตั้ง Supabase'
                : 'เปิดรายการโปรเจกต์ที่บันทึกไว้'
          }
        >
          📂 เปิด
        </button>
        <SaveButton />
        <button
          type="button"
          onClick={() => useUIStore.getState().setSidePanelTab('ai')}
          disabled={!page}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-ink-inverse hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          title={page ? 'เปิดแท็บ AI' : 'เปิดแบบก่อน'}
        >
          🤖 AI วิเคราะห์
        </button>
        <UserMenu />
      </div>

      {showProjectList && (
        <ProjectListModal onClose={() => setShowProjectList(false)} />
      )}
    </header>
  );
}
