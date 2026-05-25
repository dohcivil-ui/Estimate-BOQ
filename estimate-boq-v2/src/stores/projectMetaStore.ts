/**
 * ProjectMeta — โครงการเดียวต่อ session (Step 2.6 จะแยกเก็บใน DB)
 */
import { create } from 'zustand';
import type { ProjectMeta } from '@/types/boq';

interface ProjectMetaState extends ProjectMeta {
  setField: <K extends keyof ProjectMeta>(key: K, value: ProjectMeta[K]) => void;
  setAll: (meta: Partial<ProjectMeta>) => void;
  reset: () => void;
}

const DEFAULT_META: ProjectMeta = {
  name: '',
  client: '',
  location: '',
  province: '',
  factorF: 1.2768, // ค่าทั่วไปของอาคารทั่วไป (ตัวอย่างจาก HANDOFF)
  vatPct: 7,
};

export const useProjectMeta = create<ProjectMetaState>((set) => ({
  ...DEFAULT_META,
  setField: (key, value) =>
    set({ [key]: value } as unknown as Partial<ProjectMetaState>),
  setAll: (meta) => set(meta),
  reset: () => set({ ...DEFAULT_META }),
}));
