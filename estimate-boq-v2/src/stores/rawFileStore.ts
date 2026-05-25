/**
 * เก็บ Blob ดิบของไฟล์ที่ user เปิด (PDF/JPG/PNG) — ใช้สำหรับ:
 *   - upload ไป Supabase Storage ตอน save
 *   - re-render bitmap ถ้า bitmap เสียหาย
 *
 * เก็บใน-memory เท่านั้น — ปิด browser แล้วหาย (ผู้ใช้ต้อง save ก่อน)
 * ไฟล์ที่ load จาก cloud จะมีค่าใน store นี้ด้วย หลัง download สำเร็จ
 */
import { create } from 'zustand';

interface RawFileState {
  /** fileId → Blob (ดิบ) */
  blobs: Map<string, Blob>;
  /** fileId → uploaded แล้วใน Storage หรือยัง */
  uploaded: Set<string>;

  setBlob: (fileId: string, blob: Blob) => void;
  getBlob: (fileId: string) => Blob | null;
  markUploaded: (fileId: string) => void;
  isUploaded: (fileId: string) => boolean;
  removeBlob: (fileId: string) => void;
  clear: () => void;
}

export const useRawFileStore = create<RawFileState>((set, get) => ({
  blobs: new Map(),
  uploaded: new Set(),

  setBlob: (fileId, blob) =>
    set((s) => {
      const next = new Map(s.blobs);
      next.set(fileId, blob);
      return { blobs: next };
    }),

  getBlob: (fileId) => get().blobs.get(fileId) ?? null,

  markUploaded: (fileId) =>
    set((s) => {
      const next = new Set(s.uploaded);
      next.add(fileId);
      return { uploaded: next };
    }),

  isUploaded: (fileId) => get().uploaded.has(fileId),

  removeBlob: (fileId) =>
    set((s) => {
      const blobs = new Map(s.blobs);
      const uploaded = new Set(s.uploaded);
      blobs.delete(fileId);
      uploaded.delete(fileId);
      return { blobs, uploaded };
    }),

  clear: () => set({ blobs: new Map(), uploaded: new Set() }),
}));
