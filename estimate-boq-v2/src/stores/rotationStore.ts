/**
 * RotationStore — image rotation degrees per page
 *
 * **สำคัญ:** rotation เป็น "visual-only" — ไม่กระทบ canonical page coordinate
 *   - measurement geometry ยังเก็บใน original page-px เหมือนเดิม
 *   - rotation แค่หมุนการแสดงผลของ raster เท่านั้น
 *   - เหมือนใน cost-estimator-v2.html (`c.rotate(imgRot * π/180)` ก่อน drawImage)
 */
import { create } from 'zustand';

interface RotationState {
  byPageId: Record<string, number>;

  get: (pageId: string | null) => number;
  set: (pageId: string, deg: number) => void;
  add: (pageId: string, delta: number) => void;
  reset: (pageId: string) => void;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export const useRotationStore = create<RotationState>((set, get) => ({
  byPageId: {},

  get: (pageId) => (pageId ? (get().byPageId[pageId] ?? 0) : 0),

  set: (pageId, deg) =>
    set((s) => ({ byPageId: { ...s.byPageId, [pageId]: round1(deg) } })),

  add: (pageId, delta) =>
    set((s) => {
      const cur = s.byPageId[pageId] ?? 0;
      return {
        byPageId: { ...s.byPageId, [pageId]: round1(cur + delta) },
      };
    }),

  reset: (pageId) =>
    set((s) => ({ byPageId: { ...s.byPageId, [pageId]: 0 } })),
}));

export const useRotationFor = (pageId: string | null): number =>
  useRotationStore((s) => (pageId ? (s.byPageId[pageId] ?? 0) : 0));
