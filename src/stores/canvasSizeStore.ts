// src/stores/canvasSizeStore.ts — ขนาดจริงของ canvas viewport (Konva Stage)
// ใช้สำหรับ zoomToBBox จากแถว Measurements/BOQ → คำนวณ pan/zoom ให้พอดี
// (App.tsx เขียนค่าจาก ResizeObserver; RightPanel + อื่นๆ อ่านมาใช้)
import { create } from 'zustand';

type CanvasSizeState = {
  width: number;
  height: number;
  setSize: (w: number, h: number) => void;
};

export const useCanvasSizeStore = create<CanvasSizeState>((set) => ({
  width: 800,
  height: 600,
  setSize: (w, h) => set({ width: Math.max(1, w), height: Math.max(1, h) }),
}));
