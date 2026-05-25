/**
 * Drawing import — รองรับหลายไฟล์
 *   - PDF: ทุกหน้า render เป็น HTMLCanvasElement @2x
 *   - JPG/PNG/WebP/BMP: หน้าเดียว
 *   - DWG/DWF: error → ขอ export PDF
 *
 * Local-only ใน Step 2.2 — ไม่อัปโหลด Storage (จะทำ Step 2.6)
 */
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type {
  DrawingFile,
  DrawingPage,
  ImportResult,
} from '@/types/drawing';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const RENDER_SCALE = 2; // @2x = สมดุลความคมชัด vs memory
const THUMB_WIDTH = 160;

export class UnsupportedFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}

export interface ImportProgress {
  fileName: string;
  /** หน้าที่กำลังทำ (1-indexed) */
  pageCurrent: number;
  /** จำนวนหน้าทั้งหมด */
  pageTotal: number;
}

export type ProgressCallback = (p: ImportProgress) => void;

/** ตัวเลือกสำหรับ load จาก cloud (preserve DB IDs) */
export interface ImportIdOverride {
  fileId?: string;
  /** array ของ pageId เรียงตาม pageNumber 1..N */
  pageIds?: string[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildThumbnail(source: HTMLCanvasElement): string {
  const ratio = THUMB_WIDTH / source.width;
  const tc = document.createElement('canvas');
  tc.width = THUMB_WIDTH;
  tc.height = Math.max(1, Math.round(source.height * ratio));
  const ctx = tc.getContext('2d');
  if (!ctx) throw new Error('thumbnail context unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, tc.width, tc.height);
  return tc.toDataURL('image/png');
}

async function renderPdf(
  file: File,
  onProgress?: ProgressCallback,
  ids?: ImportIdOverride,
): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  const fileId = ids?.fileId ?? crypto.randomUUID();
  const drawingFile: DrawingFile = {
    id: fileId,
    name: file.name,
    sourceType: 'pdf',
    pageCount: doc.numPages,
    fileSize: file.size,
    importedAt: nowIso(),
  };

  const pages: DrawingPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas context unavailable');

    await page.render({ canvasContext: ctx, viewport }).promise;

    pages.push({
      id: ids?.pageIds?.[n - 1] ?? crypto.randomUUID(),
      fileId,
      pageNumber: n,
      pageWidth: canvas.width,
      pageHeight: canvas.height,
      renderScale: RENDER_SCALE,
      bitmap: canvas,
      thumbnailDataUrl: buildThumbnail(canvas),
    });

    onProgress?.({
      fileName: file.name,
      pageCurrent: n,
      pageTotal: doc.numPages,
    });

    // ให้ event loop หายใจระหว่าง render ทำให้ UI ไม่ค้าง
    await new Promise<void>((r) => setTimeout(r, 0));
  }

  return { file: drawingFile, pages };
}

async function renderImage(
  file: File,
  onProgress?: ProgressCallback,
  ids?: ImportIdOverride,
): Promise<ImportResult> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`โหลดรูปไม่สำเร็จ: ${file.name}`));
      im.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas context unavailable');
    ctx.drawImage(img, 0, 0);

    const fileId = ids?.fileId ?? crypto.randomUUID();
    const drawingFile: DrawingFile = {
      id: fileId,
      name: file.name,
      sourceType: 'image',
      pageCount: 1,
      fileSize: file.size,
      importedAt: nowIso(),
    };
    const pageObj: DrawingPage = {
      id: ids?.pageIds?.[0] ?? crypto.randomUUID(),
      fileId,
      pageNumber: 1,
      pageWidth: canvas.width,
      pageHeight: canvas.height,
      renderScale: 1,
      bitmap: canvas,
      thumbnailDataUrl: buildThumbnail(canvas),
    };

    onProgress?.({
      fileName: file.name,
      pageCurrent: 1,
      pageTotal: 1,
    });

    return { file: drawingFile, pages: [pageObj] };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadDrawingFile(
  file: File,
  onProgress?: ProgressCallback,
  ids?: ImportIdOverride,
): Promise<ImportResult> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.dwg') || lower.endsWith('.dwf')) {
    throw new UnsupportedFormatError(
      'รูปแบบ DWG/DWF ยังไม่รองรับใน MVP — กรุณา export เป็น PDF จาก AutoCAD ก่อน',
    );
  }
  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    return renderPdf(file, onProgress, ids);
  }
  if (
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|bmp)$/i.test(file.name)
  ) {
    return renderImage(file, onProgress, ids);
  }
  throw new UnsupportedFormatError(`ไม่รู้จักรูปแบบไฟล์: ${file.name}`);
}

/** โหลดหลายไฟล์ขนานกัน (แต่ render หน้าใน file เดียวกันแบบ sequential) */
export async function loadDrawingFiles(
  files: File[],
  onProgress?: ProgressCallback,
): Promise<{ results: ImportResult[]; errors: Array<{ file: File; error: Error }> }> {
  const results: ImportResult[] = [];
  const errors: Array<{ file: File; error: Error }> = [];

  for (const file of files) {
    try {
      const r = await loadDrawingFile(file, onProgress);
      results.push(r);
    } catch (err) {
      errors.push({
        file,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  return { results, errors };
}
