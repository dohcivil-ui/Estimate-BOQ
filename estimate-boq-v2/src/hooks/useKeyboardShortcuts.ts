/**
 * Keyboard shortcuts ทั่วทั้ง app
 *   F3 = toggle snap
 *   F8 = toggle ortho
 *   Shift (down/up) = temporary ortho
 *   Esc = cancel draft / deselect
 *   Enter = commit draft
 *   Backspace = pop draft point
 *   Ctrl+Z = undo
 *   Ctrl+Shift+Z / Ctrl+Y = redo
 *   Delete = remove selected
 *   0 / F = fit page
 *   V/H/K/L/A/C/D/R = tool select
 */
import { useEffect } from 'react';
import { useSnapStore } from '@/stores/snapStore';
import { useOrthoStore } from '@/stores/orthoStore';
import { useToolStore } from '@/stores/toolStore';
import { useMeasurementStore } from '@/stores/measurementStore';
import { useDetectionStore } from '@/stores/detectionStore';
import { useDrawingStore } from '@/stores/drawingStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useCanvasSize } from '@/stores/canvasSizeStore';
import type { Tool } from '@/types/tool';

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  h: 'pan',
  k: 'scale',
  l: 'length',
  a: 'area',
  c: 'count',
  g: 'paint',
  d: 'grid',
  r: 'dimension',
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  if (
    target instanceof HTMLElement &&
    target.isContentEditable
  )
    return true;
  return false;
}

/** เรียกครั้งเดียวที่ root — handle ทุก shortcut */
export function useKeyboardShortcuts(opts: {
  onCommitDraft: () => void;
  onCancelDraft: () => void;
}): void {
  const { onCommitDraft, onCancelDraft } = opts;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      // Shift state — ortho temporary
      if (e.key === 'Shift' && !e.repeat) {
        useOrthoStore.getState().setShiftDown(true);
      }

      // F3 / F8
      if (e.key === 'F3') {
        e.preventDefault();
        useSnapStore.getState().toggleEnabled();
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        useOrthoStore.getState().toggleEnabled();
        return;
      }

      // Esc — ออกจาก copy-stamp ก่อน · ไม่งั้น cancel draft / deselect
      if (e.key === 'Escape') {
        e.preventDefault();
        const det = useDetectionStore.getState();
        if (det.stamp) {
          det.stopStamp();
          return;
        }
        const tool = useToolStore.getState();
        if (tool.draftPoints.length > 0) {
          onCancelDraft();
        } else {
          useMeasurementStore.getState().select(null);
          // ล้างเส้น grid ที่เลือก + จุดเริ่มเส้นที่ค้าง (inc2.5)
          tool.setSelectedGridLine(null);
          tool.setGridPendingStart(null);
          // ล้างเส้น dimension ที่เลือก + จุดเริ่มเส้นที่ค้าง (R1-C8b)
          tool.setSelectedDimLine(null);
          tool.setDimPendingStart(null);
        }
        return;
      }

      // Enter — commit
      if (e.key === 'Enter') {
        e.preventDefault();
        onCommitDraft();
        return;
      }

      // Backspace — ตอนวาด = ถอยจุด · ไม่งั้นตกไปเป็น "ลบ marker ที่เลือก" ด้านล่าง
      if (e.key === 'Backspace') {
        const tool = useToolStore.getState();
        if (tool.draftPoints.length > 0) {
          e.preventDefault();
          tool.popDraftPoint();
          return;
        }
      }

      // paint tool active → undo/redo/delete ทำกับ detectionStore
      const paintActive = useToolStore.getState().activeTool === 'paint';

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (paintActive) useDetectionStore.getState().undo();
        else useMeasurementStore.getState().undo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' ||
          (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        if (paintActive) useDetectionStore.getState().redo();
        else useMeasurementStore.getState().redo();
        return;
      }

      // Ctrl+C — คัดลอก marker ที่เลือก (1 ตัว) เข้าโหมดคัดลอกวาง
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'c') {
        const ids = useDetectionStore.getState().selectedIds;
        if (ids.length === 1) {
          e.preventDefault();
          useDetectionStore.getState().startStamp(ids[0]!);
        }
        return;
      }

      // Delete / Backspace — ลบ marker ที่เลือก (ทุก tool) · ไม่งั้นลบ measurement
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const detIds = useDetectionStore.getState().selectedIds;
        if (detIds.length > 0) {
          e.preventDefault();
          useDetectionStore.getState().deleteMembers(detIds);
          return;
        }
        // เส้น grid ที่เลือกไว้ (inc2.5) — ลบทิ้ง
        const gridSel = useToolStore.getState().selectedGridLine;
        if (gridSel != null) {
          e.preventDefault();
          useToolStore.getState().removeGridLine(gridSel);
          return;
        }
        // เส้น dimension ที่เลือกไว้ (R1-C8b) — ลบทิ้ง
        const dimSel = useToolStore.getState().selectedDimLine;
        if (dimSel != null) {
          e.preventDefault();
          useToolStore.getState().removeDimLine(dimSel);
          return;
        }
        if (e.key === 'Delete') {
          const selId = useMeasurementStore.getState().selectedId;
          if (selId) {
            e.preventDefault();
            useMeasurementStore.getState().remove(selId);
          }
        }
        return;
      }

      // Fit (0 / F)
      if (e.key === '0' || e.key.toLowerCase() === 'f') {
        const drawing = useDrawingStore.getState();
        const page = drawing.pages.find((p) => p.id === drawing.activePageId);
        if (!page) return;
        const { width, height } = useCanvasSize.getState();
        if (width === 0 || height === 0) return;
        e.preventDefault();
        useViewportStore
          .getState()
          .fit(page.id, width, height, page.pageWidth, page.pageHeight);
        return;
      }

      // Tool hotkeys (ไม่ใช้ตอน Ctrl/Meta)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = TOOL_KEYS[e.key.toLowerCase()];
        if (t) {
          e.preventDefault();
          useToolStore.getState().setActiveTool(t);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        useOrthoStore.getState().setShiftDown(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onCommitDraft, onCancelDraft]);
}
