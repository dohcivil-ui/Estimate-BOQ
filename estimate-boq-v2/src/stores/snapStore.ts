/**
 * SnapStore — snap toggles + thresholds
 * SR (snap radius) ที่ 12 screen px (จาก cost-estimator-v2) — แปลงเป็น page-px ตอนใช้
 */
import { create } from 'zustand';
import type { SnapToggles } from '@/core/snap';

export type ImageSnapSensitivity = 'dark' | 'normal' | 'faint';

const SENSITIVITY_THRESHOLD: Record<ImageSnapSensitivity, number> = {
  dark: 90,
  normal: 130,
  faint: 170,
};

interface SnapState {
  enabled: boolean;
  toggles: SnapToggles;
  /** snap radius เป็น screen px (= 12 ใน cost-estimator-v2) */
  screenRadius: number;
  imageSnap: boolean;
  imageSensitivity: ImageSnapSensitivity;

  setEnabled: (v: boolean) => void;
  toggleEnabled: () => void;
  setToggle: (k: keyof SnapToggles, v: boolean) => void;
  setImageSnap: (v: boolean) => void;
  setImageSensitivity: (v: ImageSnapSensitivity) => void;
}

export const useSnapStore = create<SnapState>((set) => ({
  enabled: true,
  toggles: {
    endpoint: true,
    midpoint: true,
    intersection: true,
    perpendicular: false,
    onEdge: false,
  },
  screenRadius: 12,
  imageSnap: false,
  imageSensitivity: 'normal',

  setEnabled: (v) => set({ enabled: v }),
  toggleEnabled: () => set((s) => ({ enabled: !s.enabled })),
  setToggle: (k, v) =>
    set((s) => ({ toggles: { ...s.toggles, [k]: v } })),
  setImageSnap: (v) => set({ imageSnap: v }),
  setImageSensitivity: (v) => set({ imageSensitivity: v }),
}));

export function getImageThreshold(s: ImageSnapSensitivity): number {
  return SENSITIVITY_THRESHOLD[s];
}
