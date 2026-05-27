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
  factorF: 0, // 0 = อัตโนมัติจากตาราง CGD 2567 (>0 = override กรอกเอง)
  vatPct: 7,
  advancePct: 0, // เงินล่วงหน้าจ่าย — เลือกตาราง Factor F CGD 2567
  retentionPct: 0, // เงินประกันผลงานหัก
};

export const useProjectMeta = create<ProjectMetaState>((set) => ({
  ...DEFAULT_META,
  setField: (key, value) =>
    set({ [key]: value } as unknown as Partial<ProjectMetaState>),
  setAll: (meta) => set(meta),
  reset: () => set({ ...DEFAULT_META }),
}));
