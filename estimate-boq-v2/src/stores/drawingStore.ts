import { create } from 'zustand';
import type { DrawingFile, DrawingPage, ImportResult } from '@/types/drawing';
import type { ImportProgress } from '@/services/loadDrawing';

interface DrawingState {
  files: DrawingFile[];
  pages: DrawingPage[];
  activePageId: string | null;

  /** สถานะ import (สำหรับโชว์ progress bar) */
  importing: boolean;
  importProgress: ImportProgress | null;
  importError: string | null;

  // ─── actions ─────────────────────────────────────────────────────────
  addImport: (result: ImportResult) => void;
  addImports: (results: ImportResult[]) => void;
  setActivePage: (pageId: string) => void;
  removeFile: (fileId: string) => void;
  clearAll: () => void;

  setImporting: (busy: boolean) => void;
  setImportProgress: (p: ImportProgress | null) => void;
  setImportError: (msg: string | null) => void;

  // ─── selectors helpers ───────────────────────────────────────────────
  getActivePage: () => DrawingPage | null;
  getPagesByFile: (fileId: string) => DrawingPage[];
  pageIndexInFile: (pageId: string) => number;
}

export const useDrawingStore = create<DrawingState>((set, get) => ({
  files: [],
  pages: [],
  activePageId: null,
  importing: false,
  importProgress: null,
  importError: null,

  addImport: (result) =>
    set((s) => ({
      files: [...s.files, result.file],
      pages: [...s.pages, ...result.pages],
      activePageId: s.activePageId ?? result.pages[0]?.id ?? null,
    })),

  addImports: (results) =>
    set((s) => {
      const newFiles = results.map((r) => r.file);
      const newPages = results.flatMap((r) => r.pages);
      return {
        files: [...s.files, ...newFiles],
        pages: [...s.pages, ...newPages],
        activePageId: s.activePageId ?? newPages[0]?.id ?? null,
      };
    }),

  setActivePage: (pageId) => set({ activePageId: pageId }),

  removeFile: (fileId) =>
    set((s) => {
      const remainingPages = s.pages.filter((p) => p.fileId !== fileId);
      const newActive =
        s.activePageId && !remainingPages.find((p) => p.id === s.activePageId)
          ? (remainingPages[0]?.id ?? null)
          : s.activePageId;
      return {
        files: s.files.filter((f) => f.id !== fileId),
        pages: remainingPages,
        activePageId: newActive,
      };
    }),

  clearAll: () =>
    set({
      files: [],
      pages: [],
      activePageId: null,
      importError: null,
    }),

  setImporting: (busy) => set({ importing: busy }),
  setImportProgress: (p) => set({ importProgress: p }),
  setImportError: (msg) => set({ importError: msg }),

  getActivePage: () => {
    const s = get();
    return s.pages.find((p) => p.id === s.activePageId) ?? null;
  },

  getPagesByFile: (fileId) =>
    get()
      .pages.filter((p) => p.fileId === fileId)
      .sort((a, b) => a.pageNumber - b.pageNumber),

  pageIndexInFile: (pageId) => {
    const page = get().pages.find((p) => p.id === pageId);
    if (!page) return -1;
    return page.pageNumber;
  },
}));

// ─── selectors (เลือกใช้แทน useDrawingStore() ตรงๆ เพื่อ minimize re-render) ──
export const useActivePageId = () =>
  useDrawingStore((s) => s.activePageId);
export const useActivePage = (): DrawingPage | null => {
  const id = useActivePageId();
  return useDrawingStore((s) =>
    id ? (s.pages.find((p) => p.id === id) ?? null) : null,
  );
};
export const useDrawingFiles = () => useDrawingStore((s) => s.files);
export const useAllPages = () => useDrawingStore((s) => s.pages);
