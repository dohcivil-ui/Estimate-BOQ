import { create } from 'zustand';
import type { Tool } from '../types';

type ToolState = {
  current: Tool;
  setTool: (t: Tool) => void;
};

export const useToolStore = create<ToolState>((set) => ({
  current: 'select',
  setTool: (t) => set({ current: t }),
}));
