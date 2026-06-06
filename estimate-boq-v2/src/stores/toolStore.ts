/**
 * ToolStore — active tool + draft state ระหว่างวาด
 * draftPoints อยู่ใน canonical page-px
 */
import { create } from 'zustand';
import type { Tool, GridLine, DimLine } from '@/types/tool';
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
  /** index ของเส้น grid ที่เลือกอยู่ (tool V) — null = ไม่ได้เลือก */
  selectedGridLine: number | null;
  /** เส้นบอกระยะที่วาดเสร็จแล้ว (page-px) — R1-C8 */
  dimensions: DimLine[];
  /** จุดเริ่มเส้น dimension ที่ค้างอยู่ (คลิกแรก) — null = ยังไม่เริ่ม */
  dimPendingStart: Point2D | null;
  /** index ของเส้น dimension ที่เลือกอยู่ — null = ไม่ได้เลือก */
  selectedDimLine: number | null;

  setActiveTool: (tool: Tool) => void;
  addDraftPoint: (p: Point2D) => void;
  popDraftPoint: () => void;
  clearDraft: () => void;
  setDraftPoints: (pts: Point2D[]) => void;
  setCursorPagePoint: (p: Point2D | null) => void;
  setGridPendingStart: (p: Point2D | null) => void;
  addGridLine: (line: GridLine) => void;
  clearGridDraft: () => void;
  setSelectedGridLine: (i: number | null) => void;
  removeGridLine: (i: number) => void;
  /** แทนที่ gridLines ทั้งชุด (hydrate ตอน loadProject — inc5) */
  setGridLines: (lines: GridLine[]) => void;
  setDimPendingStart: (p: Point2D | null) => void;
  addDimLine: (line: DimLine) => void;
  clearDimDraft: () => void;
  setSelectedDimLine: (i: number | null) => void;
  removeDimLine: (i: number) => void;
  /** ตั้งระยะจริง (เมตร) ของเส้น i — human-only (R1-C8) */
  setDimValue: (i: number, valueM: number | null) => void;
  /** แทนที่ dimensions ทั้งชุด (hydrate ตอน loadProject — R1-C8) */
  setDimLines: (lines: DimLine[]) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'select',
  draftPoints: [],
  cursorPagePoint: null,
  gridLines: [],
  gridPendingStart: null,
  selectedGridLine: null,
  dimensions: [],
  dimPendingStart: null,
  selectedDimLine: null,

  setActiveTool: (tool) => {
    // เปลี่ยน tool = ออกจากโหมดคัดลอกวาง (copy-stamp) เสมอ
    // หมายเหตุ: ไม่ล้าง gridLines แล้ว (inc2.5) — เก็บเส้นไว้ข้าม tool เพื่อเลือก/ลบด้วย V
    useDetectionStore.getState().stopStamp();
    set({ activeTool: tool, draftPoints: [], cursorPagePoint: null, gridPendingStart: null, selectedGridLine: null, dimPendingStart: null, selectedDimLine: null });
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
  setSelectedGridLine: (i) => set({ selectedGridLine: i }),
  removeGridLine: (i) =>
    set((s) => ({
      gridLines: s.gridLines.filter((_, idx) => idx !== i),
      selectedGridLine: null,
    })),
  setGridLines: (lines) => set({ gridLines: lines, selectedGridLine: null }),
  setDimPendingStart: (p) => set({ dimPendingStart: p }),
  addDimLine: (line) => set((s) => ({ dimensions: [...s.dimensions, line] })),
  clearDimDraft: () => set({ dimensions: [], dimPendingStart: null }),
  setSelectedDimLine: (i) => set({ selectedDimLine: i }),
  removeDimLine: (i) =>
    set((s) => ({
      dimensions: s.dimensions.filter((_, idx) => idx !== i),
      selectedDimLine: null,
    })),
  setDimValue: (i, valueM) =>
    set((s) => ({
      dimensions: s.dimensions.map((d, idx) => (idx === i ? { ...d, valueM } : d)),
    })),
  setDimLines: (lines) => set({ dimensions: lines, selectedDimLine: null }),
}));

export const useActiveTool = () => useToolStore((s) => s.activeTool);
