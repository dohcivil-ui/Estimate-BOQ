/**
 * BOQ store (v2 — reactive architecture)
 *
 * Source of truth = disciplineGroups[] (แยกตาม discipline + pageId)
 *   - AI วิเคราะห์ใหม่ → replacePageItems() = REPLACE เฉพาะหน้านั้น (ไม่ append)
 *   - items: BOQItem[] เป็น "mirror" แบนราบ = flatten(groups) — sync ทุกครั้งที่ groups เปลี่ยน
 *     เพื่อ backward-compat กับ component เดิมที่อ่าน store.items
 * undo/redo = snapshot ของ disciplineGroups
 */
import { create } from 'zustand';
import type { BOQItem, Discipline, DisciplineGroup } from '@/types/boq';

const HISTORY_LIMIT = 50;

/** pageId สำหรับรายการที่ไม่มี page context (เพิ่มเอง/preset/วัด/import) */
export const MANUAL_PAGE_ID = 'manual';

interface BOQState {
  /** ★ source of truth */
  disciplineGroups: DisciplineGroup[];
  /** mirror แบนราบ = flatten(disciplineGroups) — ห้าม set ตรง ใช้ผ่าน method */
  items: BOQItem[];
  selectedId: string | null;
  past: DisciplineGroup[][];
  future: DisciplineGroup[][];

  // ─── reactive (blueprint) ───
  /** AI วิเคราะห์เสร็จ → REPLACE items ของหน้านั้น (ไม่กระทบหน้าอื่น) */
  replacePageItems: (
    pageId: string,
    discipline: Discipline,
    pageName: string,
    newItems: BOQItem[],
  ) => void;
  getAllItems: () => BOQItem[];
  getItemsByDiscipline: (d: Discipline) => BOQItem[];
  /** แทนที่ groups ทั้งหมด (ใช้ตอน load จาก DB) — reset history */
  setGroups: (groups: DisciplineGroup[]) => void;

  // ─── API เดิม (route ผ่าน groups + sync mirror) ───
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

const now = (): string => new Date().toISOString();

const flatten = (groups: DisciplineGroup[]): BOQItem[] =>
  groups.flatMap((g) => g.items);

function pushHistory(
  past: DisciplineGroup[][],
  current: DisciplineGroup[],
): DisciplineGroup[][] {
  const next = [...past, current];
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}

/** set groups ใหม่ + sync mirror + push history (1 entry) */
function commit(
  s: BOQState,
  nextGroups: DisciplineGroup[],
): Pick<BOQState, 'past' | 'future' | 'disciplineGroups' | 'items'> {
  return {
    past: pushHistory(s.past, s.disciplineGroups),
    future: [],
    disciplineGroups: nextGroups,
    items: flatten(nextGroups),
  };
}

/** append items เข้า manual group (สร้างถ้ายังไม่มี) */
function appendToManual(
  groups: DisciplineGroup[],
  newItems: BOQItem[],
): DisciplineGroup[] {
  const idx = groups.findIndex((g) => g.pageId === MANUAL_PAGE_ID);
  if (idx >= 0) {
    const next = groups.slice();
    next[idx] = { ...next[idx]!, items: [...next[idx]!.items, ...newItems] };
    return next;
  }
  return [
    ...groups,
    {
      discipline: 'other',
      pageId: MANUAL_PAGE_ID,
      pageName: 'รายการเพิ่มเอง',
      items: newItems,
      analyzedAt: now(),
      status: 'draft',
    },
  ];
}

export const useBOQStore = create<BOQState>((set, get) => ({
  disciplineGroups: [],
  items: [],
  selectedId: null,
  past: [],
  future: [],

  // ──────────────────────────────────────────────────────────────
  // 🔑 AI วิเคราะห์เสร็จ → REPLACE ทั้งหน้า (ลบเก่า ใส่ใหม่ ไม่ append)
  // ──────────────────────────────────────────────────────────────
  replacePageItems: (pageId, discipline, pageName, newItems) =>
    set((s) => {
      const group: DisciplineGroup = {
        discipline,
        pageId,
        pageName,
        items: newItems,
        analyzedAt: now(),
        status: 'draft',
      };
      const idx = s.disciplineGroups.findIndex((g) => g.pageId === pageId);
      const next = s.disciplineGroups.slice();
      if (idx >= 0) next[idx] = group; // ★ REPLACE
      else next.push(group); // ★ ADD หน้าใหม่
      return commit(s, next);
    }),

  getAllItems: () => flatten(get().disciplineGroups),

  getItemsByDiscipline: (d) =>
    get()
      .disciplineGroups.filter((g) => g.discipline === d)
      .flatMap((g) => g.items),

  setGroups: (groups) =>
    set({
      disciplineGroups: groups,
      items: flatten(groups),
      past: [],
      future: [],
      selectedId: null,
    }),

  add: (item) => set((s) => commit(s, appendToManual(s.disciplineGroups, [item]))),

  addMany: (items) =>
    set((s) =>
      items.length === 0 ? s : commit(s, appendToManual(s.disciplineGroups, items)),
    ),

  update: (id, patch) =>
    set((s) => {
      let found = false;
      const next = s.disciplineGroups.map((g) => {
        const i = g.items.findIndex((it) => it.id === id);
        if (i === -1) return g;
        found = true;
        const items = g.items.slice();
        items[i] = { ...items[i]!, ...patch, updatedAt: now() };
        return { ...g, items };
      });
      if (!found) return s;
      return commit(s, next);
    }),

  remove: (id) =>
    set((s) => {
      const exists = s.disciplineGroups.some((g) =>
        g.items.some((it) => it.id === id),
      );
      if (!exists) return s;
      const next = s.disciplineGroups
        .map((g) => ({ ...g, items: g.items.filter((it) => it.id !== id) }))
        .filter((g) => g.items.length > 0); // prune กลุ่มที่ว่าง
      return {
        ...commit(s, next),
        selectedId: s.selectedId === id ? null : s.selectedId,
      };
    }),

  removeAll: () =>
    set((s) => {
      if (s.disciplineGroups.length === 0) return s;
      return { ...commit(s, []), selectedId: null };
    }),

  select: (id) => set({ selectedId: id }),

  reorder: (fromIdx, toIdx) =>
    set((s) => {
      // reorder ภายในกลุ่มเดียวกัน (UI ปัจจุบันยังไม่ใช้ — คง API ไว้)
      if (fromIdx === toIdx) return s;
      const locate = (flat: number): { gi: number; li: number } | null => {
        let acc = 0;
        for (let gi = 0; gi < s.disciplineGroups.length; gi++) {
          const len = s.disciplineGroups[gi]!.items.length;
          if (flat < acc + len) return { gi, li: flat - acc };
          acc += len;
        }
        return null;
      };
      const a = locate(fromIdx);
      const b = locate(toIdx);
      if (!a || !b || a.gi !== b.gi) return s; // ข้ามกลุ่ม = ไม่รองรับ
      const next = s.disciplineGroups.slice();
      const g = next[a.gi]!;
      const items = g.items.slice();
      const [moved] = items.splice(a.li, 1);
      items.splice(b.li, 0, moved!);
      next[a.gi] = { ...g, items };
      return commit(s, next);
    }),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1]!;
      return {
        disciplineGroups: prev,
        items: flatten(prev),
        past: s.past.slice(0, -1),
        future: [s.disciplineGroups, ...s.future].slice(0, HISTORY_LIMIT),
        selectedId: null,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0]!;
      return {
        disciplineGroups: next,
        items: flatten(next),
        past: pushHistory(s.past, s.disciplineGroups),
        future: s.future.slice(1),
        selectedId: null,
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
