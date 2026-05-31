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
  source: MemberSource;
  status: MemberStatus;
}

/**
 * มิติที่ผู้ใช้พิมพ์เองต่อ mark (ทาง A — compute structural BOQ โดยไม่พึ่ง AI)
 *   - key ใน markDims = mark normalize UPPERCASE
 *   - count มาจาก tag (tallyMembers) · มิติมาจาก dict นี้ · ปริมาณ = compute เดิม
 *   - rebar เก็บเป็น string ดิบ (เช่น "16-DB12") แล้ว parse ใน builder
 */
export type MarkDims =
  | {
      kind: 'footing';
      W: number;
      L: number;
      T: number;
      depth: number;
      rebar: string;
    }
  | {
      kind: 'column';
      W: number;
      L: number;
      H: number;
      vBars: string;
      tie: string;
    }
  | {
      kind: 'beam';
      W: number;
      H: number;
      pieces: { length: number; count: number }[];
      mainBars: string;
      stirrup: string;
    }
  | {
      kind: 'slab';
      areaSqm: number;
      thickness: number;
      meshWireMM: number;
      meshSpacing: number;
      sandThk?: number;
    };

/** ต้นแบบสำหรับ copy-stamp — เก็บ ชื่อ+สี+ขนาด ของ marker ที่จะคัดลอกวาง */
export interface StampTemplate {
  mark: string;
  category: MemberCategory;
  color: string;
  w: number;
  h: number;
}

const HISTORY_LIMIT = 50;
const uid = (): string => crypto.randomUUID();

function pushHistory(past: Member[][], current: Member[]): Member[][] {
  const next = [...past, current];
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}

/**
 * หา member ที่ bbox (page-px) คลุมจุด p — null ถ้าไม่โดน
 *   smallest-first: ถ้าจุดอยู่ในหลายกล่อง (เช่น เสาเล็กซ้อนในฐานใหญ่) คืน "ตัวพื้นที่
 *   เล็กสุด" (ไม่ใช่ตัวบนสุดตาม draw order) — ให้คลิก/ชี้กลางเสาโดนเสา ไม่โดนฐาน
 * @param padPage เผื่อขอบกล่อง (page-px) ให้คลิกโดนง่ายขึ้น — marker เล็ก ๆ คลิกยาก
 */
export function findMemberAt(
  members: Member[],
  p: { x: number; y: number },
  padPage = 0,
): Member | null {
  let best: Member | null = null;
  let bestArea = Infinity;
  for (const m of members) {
    const g = m.geometry;
    if (!g) continue;
    if (
      p.x >= g.x - padPage &&
      p.x <= g.x + g.w + padPage &&
      p.y >= g.y - padPage &&
      p.y <= g.y + g.h + padPage
    ) {
      const area = g.w * g.h;
      if (area < bestArea) {
        bestArea = area;
        best = m;
      }
    }
  }
  return best;
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
  /** สี active สำหรับ marker ใหม่ (transient) — สีอิสระจากชื่อ */
  paintColor: string;
  /** ข้อความเตือนชั่วคราว (เช่น ระบายโดยยังไม่เลือกชื่อ) */
  paintError: string | null;
  /** จำนวนที่ AI grid-first คาดต่อ mark (transient) — cross-check กฎ 11 */
  expectedByMark: Record<string, number>;
  /** ต้นแบบ copy-stamp (transient) — null = ไม่อยู่ในโหมดคัดลอกวาง */
  stamp: StampTemplate | null;
  /** กำลังอ่านป้าย OCR อยู่ (transient) */
  ocrBusy: boolean;
  /** ข้อความสถานะ OCR (เช่น กำลังโหลดตัวอ่านป้าย…) */
  ocrStatus: string | null;
  /** มิติที่ผู้ใช้พิมพ์ต่อ mark (key = UPPERCASE) — ไม่เข้า history ของ members */
  markDims: Record<string, MarkDims>;
  past: Member[][];
  future: Member[][];

  // ── mutations (push history) ───────────────────────────────
  /** เปลี่ยนชื่อ mark — อัปเดต category เท่านั้น (สีอิสระจากชื่อ ไม่ทับ) */
  renameMark: (ids: string[], mark: string) => void;
  /** ตั้งสีของชิ้นที่เลือก */
  setColor: (ids: string[], hex: string) => void;
  /** ย้ายตำแหน่ง member (เปลี่ยนแค่ x,y) — pushHist=true เฉพาะจังหวะแรกของการลาก
   *  เพื่อให้ทั้ง drag เป็น undo เดียว (ไม่ push ทุก mousemove) */
  moveMember: (id: string, x: number, y: number, pushHist: boolean) => void;
  /** เพิ่ม member เอง — color ไม่ส่งมา = ใช้ paintColor ปัจจุบัน */
  addMember: (
    m: Omit<Member, 'id' | 'color' | 'status'> &
      Partial<Pick<Member, 'status' | 'color'>>,
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
  /** ตั้งสี active สำหรับ marker ใหม่ */
  setPaintColor: (hex: string) => void;
  setPaintError: (msg: string | null) => void;

  // ── copy-stamp (transient) ─────────────────────────────────
  /** เข้าโหมดคัดลอกวาง โดยใช้ member id เป็นต้นแบบ (ต้องมี geometry) */
  startStamp: (id: string) => void;
  /** ออกจากโหมดคัดลอกวาง */
  stopStamp: () => void;

  // ── cross-check + OCR (transient) ──────────────────────────
  /** ตั้งจำนวนคาดต่อ mark (จากผล AI extract) — ใช้เทียบกับที่ยืนยัน */
  setExpected: (map: Record<string, number>) => void;
  /** ตั้งสถานะ OCR (busy + ข้อความ) */
  setOcr: (busy: boolean, status?: string | null) => void;

  // ── markDims (ทาง A — มิติต่อ mark) ───────────────────────
  /** ตั้ง/แก้มิติของ mark (normalize key เป็น UPPERCASE) */
  setMarkDim: (mark: string, dims: MarkDims) => void;
  /** ลบมิติของ mark */
  clearMarkDim: (mark: string) => void;

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
  paintColor: '#ef4444',
  paintError: null,
  stamp: null,
  expectedByMark: {},
  ocrBusy: false,
  ocrStatus: null,
  markDims: {},
  past: [],
  future: [],

  renameMark: (ids, mark) =>
    set((s) => {
      if (ids.length === 0) return s;
      const idset = new Set(ids);
      const category = categoryForMark(mark);
      // สีอิสระจากชื่อ — rename อัปเดตแค่ mark + category ไม่แตะ color
      const next = s.members.map((m) =>
        idset.has(m.id) ? { ...m, mark, category } : m,
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
        idset.has(m.id) ? { ...m, color: hex } : m,
      );
      return {
        past: pushHistory(s.past, s.members),
        future: [],
        members: next,
      };
    }),

  moveMember: (id, x, y, pushHist) =>
    set((s) => {
      let changed = false;
      const next = s.members.map((m) => {
        if (m.id === id && m.geometry) {
          changed = true;
          return { ...m, geometry: { ...m.geometry, x, y } };
        }
        return m;
      });
      if (!changed) return s;
      return pushHist
        ? { past: pushHistory(s.past, s.members), future: [], members: next }
        : { members: next };
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
          color: m.color ?? s.paintColor,
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
  setPaintColor: (hex) => set({ paintColor: hex }),
  setPaintError: (msg) => set({ paintError: msg }),

  startStamp: (id) =>
    set((s) => {
      const m = s.members.find((x) => x.id === id);
      if (!m || !m.geometry) return s;
      return {
        stamp: {
          mark: m.mark,
          category: m.category,
          color: m.color,
          w: m.geometry.w,
          h: m.geometry.h,
        },
      };
    }),
  stopStamp: () => set({ stamp: null }),

  setExpected: (map) => set({ expectedByMark: map }),
  setOcr: (busy, status) =>
    set({ ocrBusy: busy, ocrStatus: status ?? null }),

  setMarkDim: (mark, dims) =>
    set((s) => ({
      markDims: { ...s.markDims, [mark.trim().toUpperCase()]: dims },
    })),
  clearMarkDim: (mark) =>
    set((s) => {
      const key = mark.trim().toUpperCase();
      if (!(key in s.markDims)) return s;
      const next = { ...s.markDims };
      delete next[key];
      return { markDims: next };
    }),

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
