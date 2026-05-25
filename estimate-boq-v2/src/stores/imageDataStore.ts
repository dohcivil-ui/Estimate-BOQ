/**
 * imageDataStore — cache ImageData ต่อ pageId สำหรับ image-snap
 * lazy: extract ImageData จาก bitmap เฉพาะหน้าที่ user เปิด image-snap (กัน memory ใช้เกิน)
 */
import { create } from 'zustand';
import type { RasterData } from '@/core/imageEdges';

interface ImageDataState {
  byPageId: Record<string, RasterData>;
  get: (pageId: string) => RasterData | null;
  set: (pageId: string, data: RasterData) => void;
  drop: (pageId: string) => void;
  clear: () => void;
}

export const useImageDataStore = create<ImageDataState>((set, get) => ({
  byPageId: {},
  get: (pageId) => get().byPageId[pageId] ?? null,
  set: (pageId, data) =>
    set((s) => ({ byPageId: { ...s.byPageId, [pageId]: data } })),
  drop: (pageId) =>
    set((s) => {
      const next = { ...s.byPageId };
      delete next[pageId];
      return { byPageId: next };
    }),
  clear: () => set({ byPageId: {} }),
}));

/**
 * คัด ImageData ออกจาก HTMLCanvasElement (เรียกครั้งเดียวต่อหน้า lazy)
 * - thrown ถ้า canvas tainted
 */
export function extractRasterData(canvas: HTMLCanvasElement): RasterData {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ไม่สามารถดึง 2d context จาก canvas ได้');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: img.data, width: img.width, height: img.height };
}
