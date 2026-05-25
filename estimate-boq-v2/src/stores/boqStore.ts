/**
 * BOQ store — items + undo/redo (snapshot-based)
 */
import { create } from 'zustand';
import type { BOQItem } from '@/types/boq';

const HISTORY_LIMIT = 50;

interface BOQState {
  items: BOQItem[];
  selectedId: string | null;
  past: BOQItem[][];
  future: BOQItem[][];

  add: (item: BOQItem) => void;
  addMany: (items: BOQItem[]) => void;
  update: (id: string, patch: Partial<BOQItem>) => void;
  remove: (id: string) => void;
  removeAll: () => void;
  select: (id: string | null) => void;
  reorder: (fromIdx: number, toIdx: number) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function pushHistory(past: BOQItem[][], current: BOQItem[]): BOQItem[][] {
  const next = [...past, current];
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}

const now = (): string => new Date().toISOString();

export const useBOQStore = create<BOQState>((set, get) => ({
  items: [],
  selectedId: null,
  past: [],
  future: [],

  add: (item) =>
    set((s) => ({
      past: pushHistory(s.past, s.items),
      future: [],
      items: [...s.items, item],
    })),

  addMany: (items) =>
    set((s) => ({
      past: pushHistory(s.past, s.items),
      future: [],
      items: [...s.items, ...items],
    })),

  update: (id, patch) =>
    set((s) => {
      const idx = s.items.findIndex((m) => m.id === id);
      if (idx === -1) return s;
      const next = s.items.slice();
      next[idx] = { ...next[idx]!, ...patch, updatedAt: now() };
      return {
        ...s,
        past: pushHistory(s.past, s.items),
        future: [],
        items: next,
      };
    }),

  remove: (id) =>
    set((s) => {
      const exists = s.items.some((m) => m.id === id);
      if (!exists) return s;
      return {
        ...s,
        past: pushHistory(s.past, s.items),
        future: [],
        items: s.items.filter((m) => m.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      };
    }),

  removeAll: () =>
    set((s) => {
      if (s.items.length === 0) return s;
      return {
        ...s,
        past: pushHistory(s.past, s.items),
        future: [],
        items: [],
        selectedId: null,
      };
    }),

  select: (id) => set({ selectedId: id }),

  reorder: (fromIdx, toIdx) =>
    set((s) => {
      if (
        fromIdx < 0 ||
        toIdx < 0 ||
        fromIdx >= s.items.length ||
        toIdx >= s.items.length ||
        fromIdx === toIdx
      )
        return s;
      const next = s.items.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved!);
      return {
        ...s,
        past: pushHistory(s.past, s.items),
        future: [],
        items: next,
      };
    }),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1]!;
      return {
        items: prev,
        past: s.past.slice(0, -1),
        future: [s.items, ...s.future].slice(0, HISTORY_LIMIT),
        selectedId: null,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0]!;
      return {
        items: next,
        past: pushHistory(s.past, s.items),
        future: s.future.slice(1),
        selectedId: null,
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
