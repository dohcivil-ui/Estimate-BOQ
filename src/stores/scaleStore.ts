// src/stores/scaleStore.ts — Scale profile ต่อ DrawingPage + Scale Tool draft state (spec §9.2)
// เก็บผลของการ calibrate (unitPerPixel เป็นเมตร/พิกเซลเสมอ); float ห้าม round
import { create } from 'zustand';
import type { PagePoint, LengthUnit } from '../types';
import { calibrateScale } from '../core/scale';

export type ScaleProfile = {
  pageId: string;
  /** จุดที่คลิก p1/p2 ใน canonical page-px (เก็บไว้สำหรับ visual reference + recalibration) */
  p1: PagePoint;
  p2: PagePoint;
  pixelDistance: number; // float, ห้าม round
  realDistance: number; // ที่ผู้ใช้กรอก (ในหน่วย unit)
  unit: LengthUnit;
  /** เมตร/พิกเซล — float */
  unitPerPixel: number;
  /** พิกเซล/เมตร — float */
  pixelPerUnit: number;
  createdAt: string;
};

/** ระยะ pixelDistance ที่สั้นกว่านี้ → เตือนให้ผู้ใช้ calibrate บนระยะยาวกว่า (spec §16) */
export const SHORT_PIXEL_DISTANCE_THRESHOLD = 100;

type DraftState =
  | { phase: 'idle' }
  | { phase: 'awaitingP2'; pageId: string; p1: PagePoint }
  | {
      phase: 'pendingConfirm';
      pageId: string;
      p1: PagePoint;
      p2: PagePoint;
      pixelDistance: number;
      /** 'calibrate' = ยังไม่มี scale บนหน้านี้; 'verify' = หน้านี้มี scale อยู่แล้ว */
      mode: 'calibrate' | 'verify';
    };

type ScaleState = {
  byPageId: Record<string, ScaleProfile>;
  draft: DraftState;

  getProfile: (pageId: string | null) => ScaleProfile | null;

  /** เริ่มลาก scale line: บันทึก p1 (page-coord, float) */
  startDraft: (pageId: string, p1: PagePoint) => void;
  /** click ที่ p2 → ปิด draft แล้วเปิด pendingConfirm (เป็นสัญญาณให้ dialog เปิด) */
  commitP2: (p2: PagePoint) => void;
  /** ยกเลิก (Esc / เปลี่ยน tool / cancel dialog) */
  cancelDraft: () => void;

  /** confirm จาก dialog mode='calibrate' → สร้าง ScaleProfile + เคลียร์ draft */
  confirmCalibration: (realDistance: number, unit: LengthUnit) => void;
  /** dismiss dialog mode='verify' (ไม่เปลี่ยน scale) */
  closeVerify: () => void;
};

export const useScaleStore = create<ScaleState>((set, get) => ({
  byPageId: {},
  draft: { phase: 'idle' },

  getProfile: (pageId) => {
    if (!pageId) return null;
    return get().byPageId[pageId] ?? null;
  },

  startDraft: (pageId, p1) => set({ draft: { phase: 'awaitingP2', pageId, p1 } }),

  commitP2: (p2) => {
    const d = get().draft;
    if (d.phase !== 'awaitingP2') return;
    const dx = p2.x - d.p1.x;
    const dy = p2.y - d.p1.y;
    const pixelDistance = Math.hypot(dx, dy);
    const hasExistingScale = !!get().byPageId[d.pageId];
    set({
      draft: {
        phase: 'pendingConfirm',
        pageId: d.pageId,
        p1: d.p1,
        p2,
        pixelDistance,
        mode: hasExistingScale ? 'verify' : 'calibrate',
      },
    });
  },

  cancelDraft: () => set({ draft: { phase: 'idle' } }),

  confirmCalibration: (realDistance, unit) => {
    const d = get().draft;
    if (d.phase !== 'pendingConfirm') return;
    const profile = calibrateScale(d.p1, d.p2, realDistance, unit);
    set((s) => ({
      byPageId: {
        ...s.byPageId,
        [d.pageId]: {
          pageId: d.pageId,
          p1: d.p1,
          p2: d.p2,
          ...profile,
          createdAt: new Date().toISOString(),
        },
      },
      draft: { phase: 'idle' },
    }));
  },

  closeVerify: () => set({ draft: { phase: 'idle' } }),
}));
