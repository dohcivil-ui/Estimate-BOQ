// src/stores/rightPanelStore.ts — แท็บ active ของ RightPanel (lift state เพื่อ toolbar สั่งสลับแท็บได้)
import { create } from 'zustand';

export type RightPanelTab = 'measurements' | 'boq' | 'ai';

type RightPanelState = {
  tab: RightPanelTab;
  setTab: (t: RightPanelTab) => void;
};

export const useRightPanelStore = create<RightPanelState>((set) => ({
  tab: 'measurements',
  setTab: (t) => set({ tab: t }),
}));
