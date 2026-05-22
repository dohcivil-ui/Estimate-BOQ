// src/stores/measurementStore.ts — Measurement[] per project (spec §8)
// + selection + undo/redo (snapshot history) — Phase 3
//
// กฎเหล็ก:
//  - geometry เก็บ **page-coord เท่านั้น** (Golden Rule #1)
//  - quantity ไหลผ่าน src/core/formula.ts เท่านั้น — ห้าม reimplement สูตรในคอมโพเนนต์
import { create } from 'zustand';
import type {
  Measurement,
  MeasurementGeometry,
  MeasurementType,
  MeasurementUnit,
} from '../types';
import { lineQuantity, polygonQuantity, rectQuantity } from '../core/formula';

export const PROJECT_ID = 'mvp-project';

/**
 * คำนวณ quantity + unit จาก geometry (PURE, ผ่าน core/formula.ts เท่านั้น)
 * unitPerPixel ไม่มี → quantity = null (ผู้เรียกควรเตือน "ยังไม่ตั้ง scale")
 */
export function computeQuantity(
  geometry: MeasurementGeometry,
  unitPerPixel: number | null,
): { quantity: number | null; unit: MeasurementUnit } {
  switch (geometry.kind) {
    case 'line':
    case 'polyline':
      return {
        quantity: unitPerPixel == null ? null : lineQuantity(geometry.points, unitPerPixel),
        unit: 'm',
      };
    case 'polygon':
      return {
        quantity: unitPerPixel == null ? null : polygonQuantity(geometry.points, unitPerPixel),
        unit: 'm2',
      };
    case 'rectangle':
      return {
        quantity:
          unitPerPixel == null
            ? null
            : rectQuantity(geometry.width, geometry.height, unitPerPixel),
        unit: 'm2',
      };
    case 'point':
      // 1 marker = 1; BOQ จะ aggregate ตาม category (Phase 4)
      return { quantity: 1, unit: 'ea' };
    case 'lasso':
      return {
        quantity:
          unitPerPixel == null ? null : polygonQuantity(geometry.points, unitPerPixel),
        unit: 'm2',
      };
  }
}

export type NewMeasurement = {
  type: MeasurementType;
  drawingPageId: string;
  geometry: MeasurementGeometry;
  scaleId: string;
  unitPerPixel: number | null;
  label?: string;
  categoryId?: string;
};

type Snapshot = {
  ids: string[];
  byId: Record<string, Measurement>;
};

type MeasurementState = {
  /** order per page (insertion order; index = ลำดับ marker ภายในหน้า/กลุ่ม) */
  byPageId: Record<string, string[]>;
  byId: Record<string, Measurement>;
  selectedIds: string[];

  /** snapshot history — ครอบ add/update/delete; selection ไม่อยู่ใน history */
  past: Snapshot[];
  future: Snapshot[];

  /** category ปัจจุบันสำหรับ Count Tool (set จาก toolbar) */
  countCategory: string;
  setCountCategory: (c: string) => void;

  // queries
  forPage: (pageId: string | null) => Measurement[];
  getById: (id: string) => Measurement | undefined;
  countByPage: () => Record<string, number>;

  // mutations
  addMeasurement: (input: NewMeasurement) => string;
  updateGeometry: (
    id: string,
    geometry: MeasurementGeometry,
    unitPerPixel: number | null,
  ) => void;
  /**
   * recompute quantity ของทุก measurement บนหน้าหนึ่ง — เรียกหลัง scale ของหน้านั้นเปลี่ยน
   * (calibrate ใหม่ / verify ใหม่) เพื่อกัน stale zero ค้างเมื่อวัดก่อนตั้ง scale
   * ไม่ push history (เป็น deterministic recompute จาก trigger ภายนอก ไม่ใช่ user action)
   */
  recomputeForPage: (pageId: string, unitPerPixel: number) => void;
  setLabel: (id: string, label: string) => void;
  setCategoryId: (id: string, categoryId: string) => void;
  deleteMeasurement: (id: string) => void;
  deleteSelected: () => void;

  // selection (ไม่อยู่ใน undo history)
  select: (ids: string[]) => void;
  toggleSelect: (id: string, additive: boolean) => void;
  clearSelection: () => void;

  // history
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

const HISTORY_LIMIT = 100;

function snapshotOf(s: Pick<MeasurementState, 'byPageId' | 'byId'>): Snapshot {
  // เก็บเฉพาะ byId + ids (รวมเรียงจากทุกหน้า) เพื่อ rebuild byPageId ได้ — ง่ายและพอ
  const ids: string[] = [];
  for (const pid of Object.keys(s.byPageId)) {
    for (const id of s.byPageId[pid]!) ids.push(id);
  }
  return { ids, byId: { ...s.byId } };
}

function rebuildPageIndex(byId: Record<string, Measurement>, ids: string[]) {
  const byPageId: Record<string, string[]> = {};
  for (const id of ids) {
    const m = byId[id];
    if (!m) continue;
    (byPageId[m.drawingPageId] ??= []).push(id);
  }
  return byPageId;
}

let _seq = 0;
function nextId(prefix: string) {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq.toString(36)}`;
}

export const useMeasurementStore = create<MeasurementState>((set, get) => {
  const pushHistory = () => {
    set((s) => ({
      past: [...s.past, snapshotOf(s)].slice(-HISTORY_LIMIT),
      future: [], // any mutation clears redo stack
    }));
  };

  return {
    byPageId: {},
    byId: {},
    selectedIds: [],
    past: [],
    future: [],
    countCategory: 'D1',
    setCountCategory: (c) => set({ countCategory: c }),

    forPage: (pageId) => {
      if (!pageId) return [];
      const s = get();
      const ids = s.byPageId[pageId] ?? [];
      const arr: Measurement[] = [];
      for (const id of ids) {
        const m = s.byId[id];
        if (m) arr.push(m);
      }
      return arr;
    },

    getById: (id) => get().byId[id],

    countByPage: () => {
      const s = get();
      const c: Record<string, number> = {};
      for (const pid of Object.keys(s.byPageId)) {
        c[pid] = s.byPageId[pid]!.length;
      }
      return c;
    },

    addMeasurement: (input) => {
      pushHistory();
      const id = nextId('m');
      const now = new Date().toISOString();
      const { quantity, unit } = computeQuantity(input.geometry, input.unitPerPixel);
      const m: Measurement = {
        id,
        projectId: PROJECT_ID,
        drawingPageId: input.drawingPageId,
        type: input.type,
        geometry: input.geometry,
        label: input.label,
        categoryId: input.categoryId,
        // quantity: 0 ถ้ายังไม่มี scale (เก็บไว้แสดง "—" ในตาราง)
        quantity: quantity ?? 0,
        unit,
        scaleId: input.scaleId,
        status: 'confirmed',
        boqLinks: [],
        createdAt: now,
        updatedAt: now,
        metadata: quantity == null ? { noScale: true } : undefined,
      };
      set((s) => ({
        byId: { ...s.byId, [id]: m },
        byPageId: {
          ...s.byPageId,
          [m.drawingPageId]: [...(s.byPageId[m.drawingPageId] ?? []), id],
        },
      }));
      return id;
    },

    updateGeometry: (id, geometry, unitPerPixel) => {
      const prev = get().byId[id];
      if (!prev) return;
      pushHistory();
      const { quantity, unit } = computeQuantity(geometry, unitPerPixel);
      const next: Measurement = {
        ...prev,
        geometry,
        quantity: quantity ?? 0,
        unit,
        updatedAt: new Date().toISOString(),
        metadata: quantity == null ? { ...(prev.metadata ?? {}), noScale: true } : (() => {
          if (!prev.metadata) return undefined;
          const { noScale: _drop, ...rest } = prev.metadata as Record<string, unknown>;
          return Object.keys(rest).length ? rest : undefined;
        })(),
      };
      set((s) => ({ byId: { ...s.byId, [id]: next } }));
    },

    recomputeForPage: (pageId, unitPerPixel) => {
      const s = get();
      const ids = s.byPageId[pageId];
      if (!ids || ids.length === 0) return;
      const nextById = { ...s.byId };
      const now = new Date().toISOString();
      let changed = false;
      for (const id of ids) {
        const prev = nextById[id];
        if (!prev) continue;
        const { quantity, unit } = computeQuantity(prev.geometry, unitPerPixel);
        // ล้าง noScale flag (รอบนี้ scale มีแล้ว)
        let metadata: Record<string, unknown> | undefined = prev.metadata;
        if (metadata && 'noScale' in metadata) {
          const { noScale: _drop, ...rest } = metadata;
          metadata = Object.keys(rest).length ? rest : undefined;
        }
        nextById[id] = {
          ...prev,
          quantity: quantity ?? 0,
          unit,
          updatedAt: now,
          metadata,
        };
        changed = true;
      }
      if (changed) set({ byId: nextById });
    },

    setLabel: (id, label) => {
      const prev = get().byId[id];
      if (!prev) return;
      pushHistory();
      set((s) => ({
        byId: {
          ...s.byId,
          [id]: { ...prev, label, updatedAt: new Date().toISOString() },
        },
      }));
    },

    setCategoryId: (id, categoryId) => {
      const prev = get().byId[id];
      if (!prev) return;
      pushHistory();
      set((s) => ({
        byId: {
          ...s.byId,
          [id]: { ...prev, categoryId, updatedAt: new Date().toISOString() },
        },
      }));
    },

    deleteMeasurement: (id) => {
      const prev = get().byId[id];
      if (!prev) return;
      pushHistory();
      set((s) => {
        const { [id]: _removed, ...restById } = s.byId;
        const pageIds = (s.byPageId[prev.drawingPageId] ?? []).filter((x) => x !== id);
        return {
          byId: restById,
          byPageId: { ...s.byPageId, [prev.drawingPageId]: pageIds },
          selectedIds: s.selectedIds.filter((x) => x !== id),
        };
      });
    },

    deleteSelected: () => {
      const s = get();
      if (s.selectedIds.length === 0) return;
      pushHistory();
      const toDelete = new Set(s.selectedIds);
      const restById: Record<string, Measurement> = {};
      for (const id of Object.keys(s.byId)) {
        if (!toDelete.has(id)) restById[id] = s.byId[id]!;
      }
      const restPage: Record<string, string[]> = {};
      for (const pid of Object.keys(s.byPageId)) {
        restPage[pid] = s.byPageId[pid]!.filter((x) => !toDelete.has(x));
      }
      set({ byId: restById, byPageId: restPage, selectedIds: [] });
    },

    select: (ids) => set({ selectedIds: ids }),
    toggleSelect: (id, additive) =>
      set((s) => {
        if (!additive) return { selectedIds: [id] };
        return s.selectedIds.includes(id)
          ? { selectedIds: s.selectedIds.filter((x) => x !== id) }
          : { selectedIds: [...s.selectedIds, id] };
      }),
    clearSelection: () => set({ selectedIds: [] }),

    undo: () => {
      const s = get();
      if (s.past.length === 0) return;
      const top = s.past[s.past.length - 1]!;
      const cur = snapshotOf(s);
      const byPageId = rebuildPageIndex(top.byId, top.ids);
      set({
        past: s.past.slice(0, -1),
        future: [...s.future, cur].slice(-HISTORY_LIMIT),
        byId: top.byId,
        byPageId,
        selectedIds: [],
      });
    },

    redo: () => {
      const s = get();
      if (s.future.length === 0) return;
      const top = s.future[s.future.length - 1]!;
      const cur = snapshotOf(s);
      const byPageId = rebuildPageIndex(top.byId, top.ids);
      set({
        future: s.future.slice(0, -1),
        past: [...s.past, cur].slice(-HISTORY_LIMIT),
        byId: top.byId,
        byPageId,
        selectedIds: [],
      });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  };
});

/** Preset categories for count tool (MVP — แก้ผ่าน UI ภายหลัง) */
export const COUNT_CATEGORIES: { id: string; label: string }[] = [
  { id: 'D1', label: 'ประตู D1' },
  { id: 'W1', label: 'หน้าต่าง W1' },
  { id: 'C1', label: 'เสา C1' },
  { id: 'L1', label: 'โคมไฟ L1' },
];
