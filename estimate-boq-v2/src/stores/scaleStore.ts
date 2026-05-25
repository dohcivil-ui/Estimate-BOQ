/**
 * ScaleStore — per-page scale (unitPerPixel)
 * สเกลผูกกับ pageId เพราะแต่ละหน้ามีอัตราส่วนต่างกันได้
 */
import { create } from 'zustand';
import type { ScaleProfile } from '@/core/scale';

interface ScaleState {
  byPageId: Record<string, ScaleProfile>;
  getScale: (pageId: string | null) => ScaleProfile | null;
  setScale: (pageId: string, profile: ScaleProfile) => void;
  clearScale: (pageId: string) => void;
}

export const useScaleStore = create<ScaleState>((set, get) => ({
  byPageId: {},

  getScale: (pageId) => {
    if (!pageId) return null;
    return get().byPageId[pageId] ?? null;
  },

  setScale: (pageId, profile) =>
    set((s) => ({ byPageId: { ...s.byPageId, [pageId]: profile } })),

  clearScale: (pageId) =>
    set((s) => {
      const next = { ...s.byPageId };
      delete next[pageId];
      return { byPageId: next };
    }),
}));

export const useScaleFor = (pageId: string | null): ScaleProfile | null =>
  useScaleStore((s) => (pageId ? (s.byPageId[pageId] ?? null) : null));
