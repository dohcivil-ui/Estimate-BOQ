/**
 * cursor position บน canvas (page coordinate) — ใช้แสดง StatusBar
 * แยก store เพื่อไม่ trigger re-render ส่วนอื่นของ app ทุกครั้งที่ขยับเมาส์
 */
import { create } from 'zustand';

interface CursorState {
  pageX: number | null;
  pageY: number | null;
  visible: boolean;
  setPagePos: (x: number, y: number) => void;
  clear: () => void;
}

export const useCursorStore = create<CursorState>((set) => ({
  pageX: null,
  pageY: null,
  visible: false,
  setPagePos: (x, y) => set({ pageX: x, pageY: y, visible: true }),
  clear: () => set({ visible: false }),
}));
