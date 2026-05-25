/**
 * OrthoStore — ortho lock (F8 toggle, Shift = ชั่วคราว)
 */
import { create } from 'zustand';

interface OrthoState {
  enabled: boolean;
  /** Shift key state — read-only จาก outside (set โดย keyboard handler) */
  shiftDown: boolean;

  toggleEnabled: () => void;
  setEnabled: (v: boolean) => void;
  setShiftDown: (v: boolean) => void;
}

export const useOrthoStore = create<OrthoState>((set) => ({
  enabled: false,
  shiftDown: false,

  toggleEnabled: () => set((s) => ({ enabled: !s.enabled })),
  setEnabled: (v) => set({ enabled: v }),
  setShiftDown: (v) => set({ shiftDown: v }),
}));

/** ortho เปิดอยู่ "ตอนนี้" หรือไม่ (toggle หรือ Shift) */
export const useOrthoActive = (): boolean =>
  useOrthoStore((s) => s.enabled || s.shiftDown);
