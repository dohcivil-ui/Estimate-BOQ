/**
 * ToolStore — active tool + draft state ระหว่างวาด
 * draftPoints อยู่ใน canonical page-px
 */
import { create } from 'zustand';
import type { Tool, GridLine } from '@/types/tool';
import type { Point2D } from '@/types/viewport';
import { useDetectionStore } from './detectionStore';

interface ToolState {
  activeTool: Tool;
  /** จุดที่กำลังวาดอยู่ (draft) — ใช้ใน scale/length/area */
  draftPoints: Point2D[];
  /** จุด cursor ปัจจุบัน (page-px) สำหรับ preview เส้นล่าสุด */
  cursorPagePoint: Point2D | null;
  /** เส้น grid ที่วาดเสร็จแล้ว (page-px) — transient inc2 (persist ใน inc5) */
  gridLines: GridLine[];
  /** จุดเริ่มเส้น grid ที่ค้างอยู่ (คลิกแรก) — null = ยังไม่เริ่ม */
  gridPendingStart: Point2D | null;

  setActiveTool: (tool: Tool) => void;
  addDraftPoint: (p: Point2D) => void;
  popDraftPoint: () => void;
  clearDraft: () => void;
  setDraftPoints: (pts: Point2D[]) => void;
  setCursorPagePoint: (p: Point2D | null) => void;
  setGridPendingStart: (p: Point2D | null) => void;
  addGridLine: (line: GridLine) => void;
  clearGridDraft: () => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'select',
  draftPoints: [],
  cursorPagePoint: null,
  gridLines: [],
  gridPendingStart: null,

  setActiveTool: (tool) => {
    // เปลี่ยน tool = ออกจากโหมดคัดลอกวาง (copy-stamp) เสมอ
    useDetectionStore.getState().stopStamp();
    set({ activeTool: tool, draftPoints: [], cursorPagePoint: null, gridLines: [], gridPendingStart: null });
  },

  addDraftPoint: (p) =>
    set((s) => ({ draftPoints: [...s.draftPoints, p] })),

  popDraftPoint: () =>
    set((s) => ({ draftPoints: s.draftPoints.slice(0, -1) })),

  clearDraft: () => set({ draftPoints: [], cursorPagePoint: null }),

  setDraftPoints: (pts) => set({ draftPoints: pts }),

  setCursorPagePoint: (p) => set({ cursorPagePoint: p }),

  setGridPendingStart: (p) => set({ gridPendingStart: p }),
  addGridLine: (line) => set((s) => ({ gridLines: [...s.gridLines, line] })),
  clearGridDraft: () => set({ gridLines: [], gridPendingStart: null }),
}));

export const useActiveTool = () => useToolStore((s) => s.activeTool);
