/**
 * Drawing import types — local in-memory model สำหรับ Step 2.2
 *
 * **CANONICAL PAGE SPACE (กฎเหล็ก, ห้ามผิด):**
 * - `pageWidth` / `pageHeight` คือขนาด "page-pixel space" ที่ **แช่แข็งตอน import**
 *   = raster ที่ render @ `renderScale` ห้ามเปลี่ยนตลอดอายุ project
 * - geometry ทุกชิ้น (scale, line, polygon, count) เก็บพิกัดใน space นี้
 * - `bitmap` คือ raster ที่ใช้ "แสดงผล" เท่านั้น เปลี่ยน/re-render ได้โดยไม่กระทบ geometry
 */

export type DrawingSourceType = 'pdf' | 'image';

export interface DrawingFile {
  id: string;
  name: string;
  sourceType: DrawingSourceType;
  /** จำนวนหน้าทั้งหมด (1 สำหรับ JPG/PNG) */
  pageCount: number;
  /** เก็บไว้แสดงและช่วย dedupe (เป็น byte) */
  fileSize: number;
  importedAt: string;
}

export interface DrawingPage {
  id: string;
  fileId: string;
  /** เลขหน้าใน file (1-indexed) */
  pageNumber: number;
  /** กว้าง canonical page-pixel (frozen @ import) ห้ามเปลี่ยน */
  pageWidth: number;
  /** สูง canonical page-pixel (frozen @ import) ห้ามเปลี่ยน */
  pageHeight: number;
  /** scale ที่ใช้ render bitmap ครั้งแรก (= pdfjs viewport scale) */
  renderScale: number;
  /** raster แสดงผลในหน้า canvas (เก็บใน memory; ไม่อัปโหลด) */
  bitmap: HTMLCanvasElement | null;
  /** thumbnail สำหรับ sidebar (data URL PNG) */
  thumbnailDataUrl: string | null;
}

/** ผลลัพธ์การโหลดไฟล์ — ส่งกลับไป store เพื่อ append */
export interface ImportResult {
  file: DrawingFile;
  pages: DrawingPage[];
}
