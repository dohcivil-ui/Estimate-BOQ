// src/stores/detectionStore.ts
// ───────────────────────────────────────────────────────────────────────
// เก็บกล่องที่ AI (Perceptron) ตรวจพบ ต่อหน้า — พิกัด page
// loop: AI เสนอ → user ยืนยัน (คลิกลบตัวผิด / วาดเพิ่มตัวที่พลาด) → เฉพาะที่เหลือ = verified → เข้า BOQ
// ───────────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import type { DetectedBox } from '@/services/boxDetect';

interface DetectionState {
  pageId: string | null;
  boxes: DetectedBox[];
  selectedId: string | null;
  busy: boolean;
  /** ข้อความดิบจากโมเดล (reasoning STEP 1-4 + สรุป) ของรอบตรวจล่าสุด */
  lastRaw: string;

  /** เซ็ตผลตรวจจับใหม่ (แทนของเดิมของหน้านั้น) */
  setBoxes: (pageId: string, boxes: DetectedBox[]) => void;
  select: (id: string | null) => void;
  /** ลบกล่องที่ AI ตรวจผิด (false positive) */
  removeBox: (id: string) => void;
  /** เพิ่มกล่องที่ AI พลาด (วาดเอง) */
  addBox: (box: DetectedBox) => void;
  setBusy: (busy: boolean) => void;
  /** เก็บข้อความดิบจากโมเดลไว้โชว์ reasoning */
  setLastRaw: (raw: string) => void;
  clearForPage: (pageId: string) => void;
  clear: () => void;
}

export const useDetectionStore = create<DetectionState>((set) => ({
  pageId: null,
  boxes: [],
  selectedId: null,
  busy: false,
  lastRaw: '',

  setBoxes: (pageId, boxes) => set({ pageId, boxes, selectedId: null }),
  select: (id) => set({ selectedId: id }),
  removeBox: (id) =>
    set((s) => ({
      boxes: s.boxes.filter((b) => b.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),
  addBox: (box) => set((s) => ({ boxes: [...s.boxes, box] })),
  setBusy: (busy) => set({ busy }),
  setLastRaw: (lastRaw) => set({ lastRaw }),
  clearForPage: (pageId) =>
    set((s) =>
      s.pageId === pageId ? { boxes: [], selectedId: null, lastRaw: '' } : s,
    ),
  clear: () =>
    set({ pageId: null, boxes: [], selectedId: null, busy: false, lastRaw: '' }),
}));

/** สรุปจำนวนต่อชนิด (สำหรับ badge เช่น "F2×12 · F1×2") */
export function countByType(boxes: DetectedBox[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of boxes) out[b.type] = (out[b.type] ?? 0) + 1;
  return out;
}
