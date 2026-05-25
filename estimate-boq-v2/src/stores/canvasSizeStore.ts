/**
 * ขนาดของ Canvas container ปัจจุบัน — broadcast จาก CanvasArea
 * เพื่อให้ component อื่น (เช่น TopBar zoom buttons) คำนวณ anchor ตรงกลางได้
 */
import { create } from 'zustand';

interface CanvasSizeState {
  width: number;
  height: number;
  setSize: (w: number, h: number) => void;
}

export const useCanvasSize = create<CanvasSizeState>((set) => ({
  width: 0,
  height: 0,
  setSize: (width, height) => set({ width, height }),
}));
