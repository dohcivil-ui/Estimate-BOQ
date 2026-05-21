// src/types/drawing.ts — Drawing import + tool types (spec §9.1, §6)

export type DrawingSourceType = 'pdf' | 'image';

export type DrawingFile = {
  id: string;
  name: string;
  sourceType: DrawingSourceType;
  importedAt: string;
};

/**
 * DrawingPage — หน้าแบบหนึ่งหน้า
 *
 * **CANONICAL PAGE SPACE (กฎเหล็ก, ห้ามผิด):**
 * - `pageWidth` / `pageHeight` คือขนาดของ "page-pixel space" ที่ **แช่แข็งตอน import**
 *   (= raster ที่ render @ `renderScale`) และ **ห้ามเปลี่ยนตลอดอายุ project**
 * - geometry ทุกชิ้น (scale, line, polygon, count) เก็บพิกัดใน space นี้
 * - `bitmap` คือ raster ที่ใช้ "แสดงผล" เท่านั้น — ถ้าวันหลัง re-render bitmap คมขึ้น
 *   (เช่น @4x) ขนาด canonical (pageWidth/pageHeight) ห้ามเปลี่ยน เพื่อให้ geometry
 *   ที่เก็บไว้ไม่ขยับ
 * - `renderScale` เก็บค่า scale ที่ render bitmap ครั้งแรก — ใช้แปลงกลับเป็น PDF point
 *   ถ้าจำเป็นในอนาคต (pdfPoint = canonical_px / renderScale)
 */
export type DrawingPage = {
  id: string;
  fileId: string;
  pageNumber: number;
  /** กว้าง canonical page-pixel (frozen @ import). ห้ามเปลี่ยน */
  pageWidth: number;
  /** สูง canonical page-pixel (frozen @ import). ห้ามเปลี่ยน */
  pageHeight: number;
  /** scale ที่ใช้ render bitmap ครั้งแรก (= ของ pdfjs viewport) */
  renderScale: number;
  /** raster ที่ใช้แสดงผล — เพิ่ม/เปลี่ยนได้โดยไม่กระทบ geometry */
  bitmap: HTMLCanvasElement | null;
  thumbnailDataUrl: string | null;
  measurementCount: number;
};

/** Tool ตาม spec §6 — MVP เริ่มจาก subset, Phase 3 จะเพิ่ม polyline/lasso */
export type Tool =
  | 'select'
  | 'pan'
  | 'scale'
  | 'line'
  | 'polyline'
  | 'area'
  | 'rect'
  | 'count';
