import { create } from 'zustand';
import type { PagePoint } from '../types';

type CursorState = {
  /** ตำแหน่งเมาส์ใน page coordinate (null = ไม่อยู่บน canvas) */
  pageCoord: PagePoint | null;
  setCursor: (p: PagePoint | null) => void;
};

export const useCursorStore = create<CursorState>((set) => ({
  pageCoord: null,
  setCursor: (p) => set({ pageCoord: p }),
}));
