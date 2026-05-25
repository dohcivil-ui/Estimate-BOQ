/**
 * MeasurementStore — confirmed measurements (per project, indexed by pageId)
 * Undo/Redo ผ่าน history stack แบบ snapshot
 */
import { create } from 'zustand';
import type { Measurement } from '@/types/measurement';

const HISTORY_LIMIT = 50;

interface MeasurementState {
  measurements: Measurement[];
  selectedId: string | null;
  /** snapshot history สำหรับ undo (each entry = full measurements list) */
  past: Measurement[][];
  future: Measurement[][];

  add: (m: Measurement) => void;
  update: (id: string, patch: Partial<Measurement>) => void;
  remove: (id: string) => void;
  select: (id: string | null) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // selectors
  getForPage: (pageId: string) => Measurement[];
}

function pushHistory(
  past: Measurement[][],
  current: Measurement[],
): Measurement[][] {
  const next = [...past, current];
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}

export const useMeasurementStore = create<MeasurementState>((set, get) => ({
  measurements: [],
  selectedId: null,
  past: [],
  future: [],

  add: (m) =>
    set((s) => ({
      past: pushHistory(s.past, s.measurements),
      future: [],
      measurements: [...s.measurements, m],
    })),

  update: (id, patch) =>
    set((s) => {
      const idx = s.measurements.findIndex((m) => m.id === id);
      if (idx === -1) return s;
      const next = s.measurements.slice();
      next[idx] = {
        ...next[idx]!,
        ...patch,
        updatedAt: new Date().toISOString(),
      } as Measurement;
      return {
        ...s,
        past: pushHistory(s.past, s.measurements),
        future: [],
        measurements: next,
      };
    }),

  remove: (id) =>
    set((s) => {
      const exists = s.measurements.some((m) => m.id === id);
      if (!exists) return s;
      return {
        ...s,
        past: pushHistory(s.past, s.measurements),
        future: [],
        measurements: s.measurements.filter((m) => m.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      };
    }),

  select: (id) => set({ selectedId: id }),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1]!;
      return {
        measurements: prev,
        past: s.past.slice(0, -1),
        future: [s.measurements, ...s.future].slice(0, HISTORY_LIMIT),
        selectedId: null,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0]!;
      return {
        measurements: next,
        past: pushHistory(s.past, s.measurements),
        future: s.future.slice(1),
        selectedId: null,
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  getForPage: (pageId) =>
    get().measurements.filter((m) => m.pageId === pageId),
}));

export const useMeasurementsForPage = (pageId: string | null): Measurement[] =>
  useMeasurementStore((s) =>
    pageId ? s.measurements.filter((m) => m.pageId === pageId) : [],
  );
