// src/pdf/loadDrawing.ts — Drawing import (spec §9.1)
// PDF → ทุกหน้า render เป็น HTMLCanvasElement @2x ; JPG/PNG → หน้าเดียว ; DWG/DWF → ขอ export PDF ก่อน

import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { DrawingFile, DrawingPage } from '../types';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const RENDER_SCALE = 2; // @2x สำหรับความคมชัด
const THUMB_WIDTH = 160;

export class UnsupportedFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}

export type ImportResult = { file: DrawingFile; pages: DrawingPage[] };

function nowIso() {
  return new Date().toISOString();
}

function buildThumbnail(source: HTMLCanvasElement): string {
  const ratio = THUMB_WIDTH / source.width;
  const tc = document.createElement('canvas');
  tc.width = THUMB_WIDTH;
  tc.height = Math.max(1, Math.round(source.height * ratio));
  const ctx = tc.getContext('2d');
  if (!ctx) throw new Error('thumbnail context unavailable');
  ctx.drawImage(source, 0, 0, tc.width, tc.height);
  return tc.toDataURL('image/png');
}

async function renderPdf(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  const fileId = crypto.randomUUID();
  const drawingFile: DrawingFile = {
    id: fileId,
    name: file.name,
    sourceType: 'pdf',
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
      id: crypto.randomUUID(),
      fileId,
      pageNumber: n,
      pageWidth: canvas.width,
      pageHeight: canvas.height,
      renderScale: RENDER_SCALE,
      bitmap: canvas,
      thumbnailDataUrl: buildThumbnail(canvas),
      measurementCount: 0,
    });
  }
  return { file: drawingFile, pages };
}

async function renderImage(file: File): Promise<ImportResult> {
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

    const fileId = crypto.randomUUID();
    const drawingFile: DrawingFile = {
      id: fileId,
      name: file.name,
      sourceType: 'image',
      importedAt: nowIso(),
    };
    const page: DrawingPage = {
      id: crypto.randomUUID(),
      fileId,
      pageNumber: 1,
      pageWidth: canvas.width,
      pageHeight: canvas.height,
      renderScale: 1, // ภาพ JPG/PNG ไม่ได้ scale ใหม่ — ใช้ขนาด natural
      bitmap: canvas,
      thumbnailDataUrl: buildThumbnail(canvas),
      measurementCount: 0,
    };
    return { file: drawingFile, pages: [page] };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadDrawingFile(file: File): Promise<ImportResult> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.dwg') || lower.endsWith('.dwf')) {
    throw new UnsupportedFormatError(
      'รูปแบบ DWG/DWF ยังไม่รองรับใน MVP — กรุณา export เป็น PDF จาก AutoCAD ก่อน',
    );
  }
  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    return renderPdf(file);
  }
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name)) {
    return renderImage(file);
  }
  throw new UnsupportedFormatError(`ไม่รู้จักรูปแบบไฟล์: ${file.name}`);
}
