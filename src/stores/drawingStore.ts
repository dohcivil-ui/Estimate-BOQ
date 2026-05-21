import { create } from 'zustand';
import type { DrawingFile, DrawingPage } from '../types';

type DrawingState = {
  files: DrawingFile[];
  pages: DrawingPage[];
  activePageId: string | null;

  addImport: (file: DrawingFile, pages: DrawingPage[]) => void;
  setActivePage: (pageId: string) => void;
  getActivePage: () => DrawingPage | null;
};

export const useDrawingStore = create<DrawingState>((set, get) => ({
  files: [],
  pages: [],
  activePageId: null,

  addImport: (file, pages) =>
    set((s) => ({
      files: [...s.files, file],
      pages: [...s.pages, ...pages],
      activePageId: s.activePageId ?? pages[0]?.id ?? null,
    })),

  setActivePage: (pageId) => set({ activePageId: pageId }),

  getActivePage: () => {
    const s = get();
    return s.pages.find((p) => p.id === s.activePageId) ?? null;
  },
}));
