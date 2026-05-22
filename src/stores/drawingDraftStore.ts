// src/stores/drawingDraftStore.ts — Draft state machine for measurement drawing tools
// (spec §6: idle → drawing → committed/cancelled)
// เก็บ draft "ระหว่างวาด" ใน page-coord; เมื่อ commit จะส่งต่อให้ measurementStore
import { create } from 'zustand';
import type { PagePoint } from '../types';

export type DraftKind = 'line' | 'polyline' | 'polygon' | 'rect';

type Draft =
  | { phase: 'idle' }
  | {
      phase: 'drawing';
      kind: 'line' | 'polyline' | 'polygon';
      pageId: string;
      points: PagePoint[];
    }
  | {
      phase: 'drawing';
      kind: 'rect';
      pageId: string;
      start: PagePoint;
      current: PagePoint;
    };

type DraftState = {
  draft: Draft;
  startPath: (kind: 'line' | 'polyline' | 'polygon', pageId: string, p: PagePoint) => void;
  appendPath: (p: PagePoint) => void;
  popPathNode: () => void;
  startRect: (pageId: string, p: PagePoint) => void;
  updateRect: (p: PagePoint) => void;
  cancel: () => void;
};

export const useDrawingDraftStore = create<DraftState>((set, get) => ({
  draft: { phase: 'idle' },

  startPath: (kind, pageId, p) =>
    set({ draft: { phase: 'drawing', kind, pageId, points: [p] } }),

  appendPath: (p) => {
    const d = get().draft;
    if (d.phase !== 'drawing') return;
    if (d.kind === 'rect') return;
    set({ draft: { ...d, points: [...d.points, p] } });
  },

  popPathNode: () => {
    const d = get().draft;
    if (d.phase !== 'drawing') return;
    if (d.kind === 'rect') return;
    if (d.points.length <= 1) {
      set({ draft: { phase: 'idle' } });
      return;
    }
    set({ draft: { ...d, points: d.points.slice(0, -1) } });
  },

  startRect: (pageId, p) =>
    set({ draft: { phase: 'drawing', kind: 'rect', pageId, start: p, current: p } }),

  updateRect: (p) => {
    const d = get().draft;
    if (d.phase !== 'drawing' || d.kind !== 'rect') return;
    set({ draft: { ...d, current: p } });
  },

  cancel: () => set({ draft: { phase: 'idle' } }),
}));
