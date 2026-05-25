/**
 * Current project — id ที่ผูกกับ Supabase row (null = unsaved)
 * + dirty flag (มีการแก้ไขที่ยังไม่ save) — สำหรับเตือนก่อนปิดหรือเปลี่ยน project
 */
import { create } from 'zustand';

interface CurrentProjectState {
  projectId: string | null;
  lastSavedAt: string | null;
  /** มีการเปลี่ยนแปลงตั้งแต่ save ครั้งล่าสุดไหม */
  dirty: boolean;

  setProjectId: (id: string | null) => void;
  setLastSavedAt: (iso: string) => void;
  setDirty: (v: boolean) => void;
  reset: () => void;
}

export const useCurrentProject = create<CurrentProjectState>((set) => ({
  projectId: null,
  lastSavedAt: null,
  dirty: false,

  setProjectId: (id) => set({ projectId: id }),
  setLastSavedAt: (iso) => set({ lastSavedAt: iso, dirty: false }),
  setDirty: (v) => set({ dirty: v }),
  reset: () => set({ projectId: null, lastSavedAt: null, dirty: false }),
}));
