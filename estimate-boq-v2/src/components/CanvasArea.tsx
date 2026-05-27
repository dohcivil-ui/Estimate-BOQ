/**
 * CanvasArea — orchestrator
 * - Konva Stage + 4 Layers (raster / measurements / draft / snap-hud)
 * - dispatch mouse events ผ่าน useCanvasInteraction
 * - drop zone overlay, import progress, error toast
 * - ScaleDialog modal
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Stage } from 'react-konva';
import type Konva from 'konva';
import { useActivePage, useDrawingStore } from '@/stores/drawingStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useCanvasSize } from '@/stores/canvasSizeStore';
import { useRotationFor } from '@/stores/rotationStore';
import { useToolStore } from '@/stores/toolStore';
import { useMeasurementsForPage } from '@/stores/measurementStore';
import { useSnapStore } from '@/stores/snapStore';
import { useScaleFor } from '@/stores/scaleStore';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { useDocumentDrop } from '@/hooks/useDocumentDrop';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { importFilesIntoStore } from '@/services/importFiles';
import { RasterLayer } from './canvas/RasterLayer';
import { GridLayer } from './canvas/GridLayer';
import { MeasurementsLayer } from './canvas/MeasurementsLayer';
import { DraftLayer } from './canvas/DraftLayer';
import { SnapHud } from './canvas/SnapHud';
import { ScaleDialog } from './ScaleDialog';

export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const { width, height } = useResizeObserver(containerRef);
  const setCanvasSize = useCanvasSize((s) => s.setSize);

  useEffect(() => {
    setCanvasSize(width, height);
  }, [width, height, setCanvasSize]);

  const page = useActivePage();
  const importing = useDrawingStore((s) => s.importing);
  const importProgress = useDrawingStore((s) => s.importProgress);
  const importError = useDrawingStore((s) => s.importError);
  const clearError = useDrawingStore((s) => s.setImportError);

  const transform = useViewportStore((s) =>
    page ? (s.byPageId[page.id] ?? null) : null,
  );

  const rotationDeg = useRotationFor(page?.id ?? null);
  const fit = useViewportStore((s) => s.fit);

  const activeTool = useToolStore((s) => s.activeTool);
  const draftPoints = useToolStore((s) => s.draftPoints);
  const cursorPagePoint = useToolStore((s) => s.cursorPagePoint);
  const measurements = useMeasurementsForPage(page?.id ?? null);

  // snap/grid state สำหรับ overlay
  const snapEnabled = useSnapStore((s) => s.enabled);
  const gridOn = useSnapStore((s) => s.toggles.grid);
  const gridSpacingM = useSnapStore((s) => s.gridSpacingM);
  const snapScreenRadius = useSnapStore((s) => s.screenRadius);
  const scale = useScaleFor(page?.id ?? null);

  const gridSpacingPage =
    snapEnabled && gridOn
      ? scale
        ? gridSpacingM / scale.unitPerPixel
        : 50
      : undefined;

  const interaction = useCanvasInteraction(page, stageRef);
  useKeyboardShortcuts({
    onCommitDraft: interaction.commitDraftAction,
    onCancelDraft: interaction.cancelDraftAction,
  });

  const { dragging } = useDocumentDrop({
    onDrop: (files) => void importFilesIntoStore(files),
    disabled: importing,
  });

  // ─── auto-fit เมื่อเปลี่ยน page หรือ resize (ครั้งแรกเท่านั้น) ────────
  useLayoutEffect(() => {
    if (!page || width === 0 || height === 0) return;
    const existing = useViewportStore.getState().byPageId[page.id];
    if (!existing) {
      fit(page.id, width, height, page.pageWidth, page.pageHeight);
    }
  }, [page, width, height, fit]);

  // cursor style ตาม tool
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const c = stage.container();
    if (activeTool === 'pan') c.style.cursor = 'grab';
    else if (activeTool === 'select') c.style.cursor = 'default';
    else c.style.cursor = 'crosshair';
  }, [activeTool, page]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-bg-base"
      onContextMenu={(e) => e.preventDefault()}
    >
      {page && transform && width > 0 && height > 0 ? (
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          onWheel={interaction.handleWheel}
          onMouseDown={interaction.handleMouseDown}
          onMouseMove={interaction.handleMouseMove}
          onMouseUp={interaction.handleMouseUp}
          onMouseLeave={interaction.handleMouseLeave}
          onDblClick={interaction.handleDoubleClick}
        >
          <RasterLayer page={page} transform={transform} rotationDeg={rotationDeg} />
          <GridLayer
            width={width}
            height={height}
            transform={transform}
            spacingPage={gridSpacingPage}
          />
          <MeasurementsLayer measurements={measurements} transform={transform} />
          <DraftLayer
            tool={activeTool}
            draftPoints={draftPoints}
            cursorPoint={cursorPagePoint}
            transform={transform}
          />
          <SnapHud
            snap={interaction.currentSnap}
            transform={transform}
            catchRadius={snapScreenRadius}
          />
        </Stage>
      ) : (
        <EmptyCanvasState importing={importing} />
      )}

      {importing && importProgress && (
        <ProgressOverlay progress={importProgress} />
      )}

      {dragging && <DropOverlay />}

      {importError && (
        <ErrorToast message={importError} onDismiss={() => clearError(null)} />
      )}

      {interaction.scaleDialog && page && (
        <ScaleDialog
          pageId={page.id}
          p1={interaction.scaleDialog.p1}
          p2={interaction.scaleDialog.p2}
          onClose={interaction.closeScaleDialog}
        />
      )}
    </div>
  );
}

function EmptyCanvasState({ importing }: { importing: boolean }) {
  if (importing) return null;
  return (
    <div className="pointer-events-none flex flex-col items-center text-center text-ink-muted">
      <div className="mb-3 text-5xl opacity-30">🏗️</div>
      <p className="text-sm">
        ลากไฟล์ PDF/JPG วางที่นี่
        <br />
        หรือกด <span className="text-ink-secondary">เปิดแบบ</span> ด้านบน
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        รองรับหลายไฟล์ในโปรเจกต์เดียวกัน
      </p>
    </div>
  );
}

function ProgressOverlay({
  progress,
}: {
  progress: { fileName: string; pageCurrent: number; pageTotal: number };
}) {
  const pct = Math.round((progress.pageCurrent / progress.pageTotal) * 100);
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm">
      <div className="w-80 rounded-lg border border-bg-border bg-bg-panel p-5 shadow-2xl">
        <p className="mb-1 text-sm font-medium text-ink-primary">
          กำลังโหลดแบบ…
        </p>
        <p
          className="mb-3 truncate text-xs text-ink-secondary"
          title={progress.fileName}
        >
          {progress.fileName}
        </p>
        <div className="mb-1 h-2 overflow-hidden rounded bg-bg-base">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-right text-xs text-ink-muted">
          หน้า {progress.pageCurrent}/{progress.pageTotal} ({pct}%)
        </p>
      </div>
    </div>
  );
}

function DropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-4 border-dashed border-accent bg-accent-subtle/30 backdrop-blur-sm">
      <div className="rounded-lg bg-bg-panel/95 px-6 py-4 text-center shadow-xl">
        <div className="mb-1 text-3xl">📥</div>
        <p className="text-sm font-medium text-accent">วางที่นี่เพื่อเปิดแบบ</p>
        <p className="text-xs text-ink-secondary">PDF · JPG · PNG · WebP</p>
      </div>
    </div>
  );
}

function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-1/2 z-30 max-w-md -translate-x-1/2 rounded-lg border border-danger/40 bg-danger/10 p-3 shadow-xl backdrop-blur-sm">
      <div className="flex items-start gap-2">
        <span className="text-danger">⚠️</span>
        <p className="flex-1 whitespace-pre-line text-xs text-ink-primary">
          {message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-ink-muted hover:text-ink-primary"
          aria-label="ปิด"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
