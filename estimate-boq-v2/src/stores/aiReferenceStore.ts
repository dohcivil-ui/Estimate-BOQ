/**
 * Reference pages — เก็บ DrawingPage.id ที่ user เลือกเป็น "หน้าอ้างอิง"
 * (รายการวัสดุ/สัญลักษณ์/รายละเอียดทั่วไป)
 *
 * ส่งให้ AI ก่อนภาพ target → AI จะเข้าใจสัญลักษณ์ F1/F2/C1/B1/...
 *
 * Persist ใน localStorage (key = "boq:ai_ref_pages")
 */
import { create } from 'zustand';

const STORAGE_KEY = 'boq:ai_ref_pages';
const MAX_REF_PAGES = 4; // จำกัดเพื่อกัน token limit + timeout

function loadFromStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch {
    // ignore
  }
  return [];
}

function saveToStorage(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore privacy mode
  }
}

interface AIReferenceState {
  /** array ของ DrawingPage.id ที่เป็น reference (เรียงตามลำดับเพิ่ม) */
  pageIds: string[];
  /** ลำดับจำกัด */
  readonly maxPages: number;

  toggle: (pageId: string) => void;
  add: (pageId: string) => boolean;
  remove: (pageId: string) => void;
  clear: () => void;
  setAll: (ids: string[]) => void;
  /** ลบ pageIds ที่ไม่อยู่ในชุด validIds (กัน localStorage ค้างจาก PDF เก่า) */
  pruneInvalid: (validIds: string[]) => void;
  has: (pageId: string) => boolean;
}

export const useAIReferenceStore = create<AIReferenceState>((set, get) => ({
  pageIds: loadFromStorage(),
  maxPages: MAX_REF_PAGES,

  has: (pageId) => get().pageIds.includes(pageId),

  toggle: (pageId) => {
    const cur = get().pageIds;
    if (cur.includes(pageId)) {
      const next = cur.filter((id) => id !== pageId);
      saveToStorage(next);
      set({ pageIds: next });
    } else {
      if (cur.length >= MAX_REF_PAGES) {
        return; // เกิน — ต้อง remove ก่อน
      }
      const next = [...cur, pageId];
      saveToStorage(next);
      set({ pageIds: next });
    }
  },

  add: (pageId) => {
    const cur = get().pageIds;
    if (cur.includes(pageId)) return true;
    if (cur.length >= MAX_REF_PAGES) return false;
    const next = [...cur, pageId];
    saveToStorage(next);
    set({ pageIds: next });
    return true;
  },

  remove: (pageId) => {
    const next = get().pageIds.filter((id) => id !== pageId);
    saveToStorage(next);
    set({ pageIds: next });
  },

  clear: () => {
    saveToStorage([]);
    set({ pageIds: [] });
  },

  setAll: (ids) => {
    const trimmed = ids.slice(0, MAX_REF_PAGES);
    saveToStorage(trimmed);
    set({ pageIds: trimmed });
  },

  pruneInvalid: (validIds) => {
    const valid = new Set(validIds);
    const cur = get().pageIds;
    const next = cur.filter((id) => valid.has(id));
    if (next.length === cur.length) return;
    saveToStorage(next);
    set({ pageIds: next });
  },
}));
