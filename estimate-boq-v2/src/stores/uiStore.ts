/**
 * UI store — tab ของ SidePanel + cross-component UI flags
 */
import { create } from 'zustand';

export type SidePanelTab = 'measure' | 'ai' | 'boq' | 'tools';

interface UIState {
  sidePanelTab: SidePanelTab;
  setSidePanelTab: (t: SidePanelTab) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidePanelTab: 'measure',
  setSidePanelTab: (t) => set({ sidePanelTab: t }),
}));
