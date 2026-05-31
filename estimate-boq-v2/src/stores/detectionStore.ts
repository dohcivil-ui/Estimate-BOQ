/**
 * detectionStore — "ชิ้นงาน" (member) ที่ถูกไฮไลต์/ระบายหมวดบน canvas
 * --------------------------------------------------------------------------
 * member 1 ตัว = ฐาน/ตอม่อ/คาน/พื้น 1 ชิ้น ที่ผูกกับ "mark" (รหัส เช่น F2, GB1)
 *   - geometry = bbox page-px (Golden Rule: เก็บเป็น page coordinate เสมอ)
 *               null = seed มาจาก AI extract แต่ยังไม่ได้ระบายตำแหน่งบนแบบ
 *   - status draft = ยังไม่ตรวจ · confirmed = ผู้ใช้ยืนยันแล้ว
 *
 * Undo/Redo: ใช้ snapshot history แบบเดียวกับ measurementStore (in-house)
 *   — ไม่พึ่ง zundo (โปรเจกต์มี pattern นี้อยู่แล้ว ไม่เพิ่ม dependency)
 *   — history เก็บเฉพาะ members[] (ไม่รวม selection — selection เป็น transient)
 */
import { create } from 'zustand';
import { getMarkColor } from '@/services/markColors';
import {
  categoryForMark,
  splitMarks,
  type MemberCategory,
} from '@/services/markParse';

// re-export เพื่อ backward-compat (ผู้เรียกเดิม import จาก store นี้)
export { categoryForMark, splitMarks };
export type { MemberCategory };

export type MemberStatus = 'draft' | 'confirmed';
export type MemberSource = 'drag' | 'pick' | 'ai' | 'manual';

/** bbox ใน page-px (มุมซ้ายบน + กว้าง/สูง) */
export interface MemberGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Member {
  id: string;
  pageId: string;
  mark: string;
  category: MemberCategory;
  posLabel?: string;
  /** null = seed counts-only (ยังไม่ระบายตำแหน่ง) */
  geometry: MemberGeometry | null;
  color: string;
  /** true = ผู้ใช้ตั้งสีเอง → rename ไม่ทับสี */
  colorLocked?: boolean;
  source: MemberSource;
  status: MemberStatus;
}

const HISTORY_LIMIT = 50;
const uid = (): string => crypto.randomUUID();

function pushHistory(past: Member[][], current: Member[]): Member[][] {
  const next = [...past, current];
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}

/** หา member ตัวบนสุดที่ bbox (page-px) คลุมจุด p — null ถ้าไม่โดน */
export function findMemberAt(
  members: Member[],
  p: { x: number; y: number },
): Member | null {
  for (let i = members.length - 1; i >= 0; i--) {
    const g = members[i]!.geometry;
    if (!g) continue;
    if (p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y && p.y <= g.y + g.h) {
      return members[i]!;
    }
  }
  return null;
}

interface DetectionState {
  members: Member[];
  /** transient — ไม่เข้า history */
  selectedIds: string[];
  /** member ที่เมาส์ชี้อยู่ (transient) — สำหรับ pill */
  hoveredId: string | null;
  /** mark ที่ถูกซ่อนบน canvas (transient) */
  hiddenMarks: string[];
  /** mark ที่จะใช้ตอน "ระบาย" กล่องใหม่ (transient) — '' = ยังไม่เลือก */
  paintMark: string;
  /** ข้อความเตือนชั่วคราว (เช่น ระบายโดยยังไม่เลือกชื่อ) */
  paintError: string | null;
  /** จำนวนที่ AI grid-first คาดต่อ mark (transient) — cross-check กฎ 11 */
  expectedByMark: Record<string, number>;
  /** กำลังอ่านป้าย OCR อยู่ (transient) */
  ocrBusy: boolean;
  /** ข้อความสถานะ OCR (เช่น กำลังโหลดตัวอ่านป้าย…) */
  ocrStatus: string | null;
  past: Member[][];
  future: Member[][];

  // ── mutations (push history) ───────────────────────────────
  /** เปลี่ยนชื่อ mark — อัปเดต category + (ถ้า !colorLocked) สีตาม mark */
  renameMark: (ids: string[], mark: string) => void;
  /** ตั้งสีเอง → ล็อกสี (rename จะไม่ทับ) */
  setColor: (ids: string[], hex: string) => void;
  /** เพิ่ม member เอง (จากการระบายกล่อง หรือเพิ่มมือ) → confirmed */
  addMember: (
    m: Omit<Member, 'id' | 'color' | 'status'> &
      Partial<Pick<Member, 'status'>>,
  ) => string;
  deleteMembers: (ids: string[]) => void;
  /** draft → confirmed */
  confirm: (ids: string[]) => void;

  // ── selection (transient) ──────────────────────────────────
  toggleSelect: (id: string) => void;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  setHovered: (id: string | null) => void;
  toggleHiddenMark: (mark: string) => void;
  setPaintMark: (mark: string) => void;
  setPaintError: (msg: string | null) => void;

  // ── cross-check + OCR (transient) ──────────────────────────
  /** ตั้งจำนวนคาดต่อ mark (จากผล AI extract) — ใช้เทียบกับที่ยืนยัน */
  setExpected: (map: Record<string, number>) => void;
  /** ตั้งสถานะ OCR (busy + ข้อความ) */
  setOcr: (busy: boolean, status?: string | null) => void;

  // ── history ────────────────────────────────────────────────
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  removeForPage: (pageId: string) => void;

  // selectors
  getForPage: (pageId: string) => Member[];
}

export const useDetectionStore = create<DetectionState>((set, get) => ({
  members: [],
  selectedIds: [],
  hoveredId: null,
  hiddenMarks: [],
  paintMark: '',
  paintError: null,
  expectedByMark: {},
  ocrBusy: false,
  ocrStatus: null,
  past: [],
  future: [],

  renameMark: (ids, mark) =>
    set((s) => {
      if (ids.length === 0) return s;
      const idset = new Set(ids);
      const category = categoryForMark(mark);
      const autoColor = getMarkColor(mark);
      const next = s.members.map((m) =>
        idset.has(m.id)
          ? {
              ...m,
              mark,
              category,
              color: m.colorLocked ? m.color : autoColor,
            }
          : m,
      );
      return {
        past: pushHistory(s.past, s.members),
        future: [],
        members: next,
      };
    }),

  setColor: (ids, hex) =>
    set((s) => {
      if (ids.length === 0) return s;
      const idset = new Set(ids);
      const next = s.members.map((m) =>
        idset.has(m.id) ? { ...m, color: hex, colorLocked: true } : m,
      );
      return {
        past: pushHistory(s.past, s.members),
        future: [],
        members: next,
      };
    }),

  addMember: (m) => {
    const id = uid();
    set((s) => ({
      past: pushHistory(s.past, s.members),
      future: [],
      members: [
        ...s.members,
        {
          ...m,
          id,
          color: getMarkColor(m.mark),
          status: m.status ?? 'confirmed',
        },
      ],
    }));
    return id;
  },

  deleteMembers: (ids) =>
    set((s) => {
      if (ids.length === 0) return s;
      const idset = new Set(ids);
      const next = s.members.filter((m) => !idset.has(m.id));
      if (next.length === s.members.length) return s;
      return {
        past: pushHistory(s.past, s.members),
        future: [],
        members: next,
        selectedIds: s.selectedIds.filter((id) => !idset.has(id)),
      };
    }),

  confirm: (ids) =>
    set((s) => {
      if (ids.length === 0) return s;
      const idset = new Set(ids);
      let changed = false;
      const next = s.members.map((m) => {
        if (idset.has(m.id) && m.status === 'draft') {
          changed = true;
          return { ...m, status: 'confirmed' as const };
        }
        return m;
      });
      if (!changed) return s;
      return {
        past: pushHistory(s.past, s.members),
        future: [],
        members: next,
      };
    }),

  toggleSelect: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),

  setSelection: (ids) => set({ selectedIds: [...ids] }),
  clearSelection: () => set({ selectedIds: [] }),
  setHovered: (id) => set({ hoveredId: id }),
  toggleHiddenMark: (mark) =>
    set((s) => ({
      hiddenMarks: s.hiddenMarks.includes(mark)
        ? s.hiddenMarks.filter((x) => x !== mark)
        : [...s.hiddenMarks, mark],
    })),
  setPaintMark: (mark) => set({ paintMark: mark, paintError: null }),
  setPaintError: (msg) => set({ paintError: msg }),

  setExpected: (map) => set({ expectedByMark: map }),
  setOcr: (busy, status) =>
    set({ ocrBusy: busy, ocrStatus: status ?? null }),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1]!;
      return {
        members: prev,
        past: s.past.slice(0, -1),
        future: [s.members, ...s.future].slice(0, HISTORY_LIMIT),
        selectedIds: [],
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0]!;
      return {
        members: next,
        past: pushHistory(s.past, s.members),
        future: s.future.slice(1),
        selectedIds: [],
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  removeForPage: (pageId) =>
    set((s) => ({
      members: s.members.filter((m) => m.pageId !== pageId),
      selectedIds: [],
    })),

  getForPage: (pageId) => get().members.filter((m) => m.pageId === pageId),
}));

export const useMembersForPage = (pageId: string | null): Member[] =>
  useDetectionStore((s) =>
    pageId ? s.members.filter((m) => m.pageId === pageId) : [],
  );
