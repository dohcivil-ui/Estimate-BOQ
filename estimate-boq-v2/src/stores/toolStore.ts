/**
 * ToolStore — active tool + draft state ระหว่างวาด
 * draftPoints อยู่ใน canonical page-px
 */
import { create } from 'zustand';
import type { Tool } from '@/types/tool';
import type { Point2D } from '@/types/viewport';

interface ToolState {
  activeTool: Tool;
  /** จุดที่กำลังวาดอยู่ (draft) — ใช้ใน scale/length/area */
  draftPoints: Point2D[];
  /** จุด cursor ปัจจุบัน (page-px) สำหรับ preview เส้นล่าสุด */
  cursorPagePoint: Point2D | null;

  setActiveTool: (tool: Tool) => void;
  addDraftPoint: (p: Point2D) => void;
  popDraftPoint: () => void;
  clearDraft: () => void;
  setDraftPoints: (pts: Point2D[]) => void;
  setCursorPagePoint: (p: Point2D | null) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'select',
  draftPoints: [],
  cursorPagePoint: null,

  setActiveTool: (tool) =>
    set({ activeTool: tool, draftPoints: [], cursorPagePoint: null }),

  addDraftPoint: (p) =>
    set((s) => ({ draftPoints: [...s.draftPoints, p] })),

  popDraftPoint: () =>
    set((s) => ({ draftPoints: s.draftPoints.slice(0, -1) })),

  clearDraft: () => set({ draftPoints: [], cursorPagePoint: null }),

  setDraftPoints: (pts) => set({ draftPoints: pts }),

  setCursorPagePoint: (p) => set({ cursorPagePoint: p }),
}));

export const useActiveTool = () => useToolStore((s) => s.activeTool);
