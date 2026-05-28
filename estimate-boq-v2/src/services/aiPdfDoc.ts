/**
 * AI PDF Document helper — สำหรับส่ง PDF page ตรงไป Anthropic (Direct)
 *
 * Flow:
 *   1. extract หน้าที่เลือกจาก PDF ต้นฉบับด้วย pdf-lib → standalone PDF (1 หน้า)
 *   2. ถ้า ≤ 20MB → encode base64 ส่ง inline ผ่าน document content block
 *      (cache_control ephemeral → reuse 5 min ระหว่าง chat follow-up)
 *   3. ถ้า > 20MB → upload ขึ้น Anthropic Files API ได้ file_id แล้ว reuse
 *      (file_id เก็บ 30 วัน บน Anthropic side)
 *
 * Cache:
 *   - in-memory cache (key = fileId:pageNum)
 *   - คงอยู่ตลอด session — re-use ทุก analyze/chat ของหน้าเดียวกัน
 *   - clear ผ่าน clearAiPdfCache() (ใช้ตอน clear all)
 */
import { PDFDocument } from 'pdf-lib';

/** เกณฑ์เปลี่ยนไป Files API — Anthropic จำกัด inline base64 PDF ที่ ~32MB แต่เราเผื่อ overhead */
const INLINE_BYTE_LIMIT = 20 * 1024 * 1024; // 20MB

/** TTL ของ file_id ใน Anthropic Files API (30 วัน) — แค่ comment, ไม่ enforce */
// const FILES_API_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** ขนาด max ของ inline base64 ที่ส่งได้ — ถ้าเกิน throw */
const HARD_LIMIT = 32 * 1024 * 1024; // 32MB raw

/** Endpoint ของ Anthropic Files API ผ่าน Vite proxy (เหมือน Messages API) */
const FILES_API_ENDPOINT = '/anthropic-api/v1/files';

/** Beta header ที่ต้องใช้กับ Files API */
const FILES_API_BETA = 'files-api-2025-04-14';

export interface InlinePdfSource {
  kind: 'base64';
  data: string;
  /** byte count ของ PDF ที่ extract แล้ว (ก่อน encode base64) */
  bytes: number;
}

export interface FileIdPdfSource {
  kind: 'file_id';
  fileId: string;
  /** byte count เดิม (เผื่อ debug) */
  bytes: number;
}

export type PdfDocSource = InlinePdfSource | FileIdPdfSource;

interface CacheEntry {
  /** promise ของ source เพื่อ dedupe concurrent extract ของหน้าเดียวกัน */
  promise: Promise<PdfDocSource>;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(fileId: string, pageNum: number): string {
  return `${fileId}:${pageNum}`;
}

/** clear cache ทั้งหมด (เรียกเมื่อ remove file หรือ clear all) */
export function clearAiPdfCache(): void {
  cache.clear();
}

/** clear cache ของ PDF file หนึ่ง (ทุกหน้า) */
export function clearAiPdfCacheForFile(fileId: string): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(`${fileId}:`)) {
      cache.delete(key);
    }
  }
}

/**
 * เรียกหลัก — รับ Blob ดิบของ PDF + เลขหน้า (1-indexed) → คืน source ที่ส่งไป Anthropic ได้
 * ใช้ cache → call ครั้งที่ 2 ของหน้าเดียวกันจะคืนค่าเดิม
 */
export async function getPdfPageSource(opts: {
  blob: Blob;
  fileId: string;
  pageNum: number;
  /** API key สำหรับ Files API (เฉพาะ path > 20MB) */
  apiKey: string;
  fileName?: string;
}): Promise<PdfDocSource> {
  const key = cacheKey(opts.fileId, opts.pageNum);
  const hit = cache.get(key);
  if (hit) return hit.promise;

  const promise = (async (): Promise<PdfDocSource> => {
    const bytes = await extractPdfPage(opts.blob, opts.pageNum);
    if (bytes.byteLength > HARD_LIMIT) {
      throw new Error(
        `หน้า PDF ใหญ่เกินไป (${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB) — Anthropic จำกัดที่ 32MB`,
      );
    }
    if (bytes.byteLength <= INLINE_BYTE_LIMIT) {
      return {
        kind: 'base64',
        data: bytesToBase64(bytes),
        bytes: bytes.byteLength,
      };
    }
    // > 20MB → upload ไป Files API แล้วใช้ file_id (cache file_id ไว้ใช้ซ้ำ)
    const fileId = await uploadPdfToFilesApi(
      bytes,
      opts.apiKey,
      opts.fileName ?? `page-${opts.pageNum}.pdf`,
    );
    return { kind: 'file_id', fileId, bytes: bytes.byteLength };
  })();

  cache.set(key, { promise });
  // ถ้า promise reject → ลบออกจาก cache เพื่อให้ลองใหม่ครั้งหน้าได้
  promise.catch(() => cache.delete(key));
  return promise;
}

/** extract 1 หน้าจาก PDF ต้นฉบับเป็น standalone PDF (Uint8Array) */
export async function extractPdfPage(
  blob: Blob,
  pageNum: number,
): Promise<Uint8Array> {
  const arrayBuf = await blob.arrayBuffer();
  // ignoreEncryption: รองรับ PDF ที่ encrypt แต่อ่านได้ (เช่น scanner output)
  const src = await PDFDocument.load(arrayBuf, { ignoreEncryption: true });
  const total = src.getPageCount();
  if (pageNum < 1 || pageNum > total) {
    throw new Error(
      `หน้า ${pageNum} เกินช่วง 1..${total} ของ PDF`,
    );
  }
  const dst = await PDFDocument.create();
  const [page] = await dst.copyPages(src, [pageNum - 1]);
  if (!page) throw new Error('copyPages ไม่คืนหน้า');
  dst.addPage(page);
  // useObjectStreams: false → ลดปัญหาเข้ากันได้ของ reader บางตัว (Anthropic OK กับทั้ง 2)
  return dst.save({ useObjectStreams: true });
}

/** แปลง Uint8Array → base64 string (ทำ chunked เพื่อกัน stack overflow กับไฟล์ใหญ่) */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

interface FilesApiResponse {
  id: string;
  type?: string;
  filename?: string;
  size_bytes?: number;
}

/** upload PDF ขึ้น Anthropic Files API → คืน file_id */
export async function uploadPdfToFilesApi(
  bytes: Uint8Array,
  apiKey: string,
  fileName: string,
): Promise<string> {
  if (!apiKey) {
    throw new Error('Files API ต้องการ Anthropic API key — ไม่พบใน config');
  }
  // copy เข้า fresh ArrayBuffer — pdf-lib อาจคืน Uint8Array<SharedArrayBuffer>
  // ที่ Blob constructor ของ TS lib.dom ไม่รับ
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const blob = new Blob([buf], { type: 'application/pdf' });
  const form = new FormData();
  form.append('file', blob, fileName);

  const res = await fetch(FILES_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': FILES_API_BETA,
      'anthropic-dangerous-direct-browser-access': 'true',
      // ห้ามใส่ content-type — ให้ browser ใส่ multipart boundary เอง
    },
    body: form,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(
      `Files API upload error ${res.status}: ${txt.slice(0, 400)}`,
    );
  }
  const json = (await res.json()) as FilesApiResponse;
  if (!json.id) throw new Error('Files API ไม่คืน file id');
  console.info(
    `[ai-pdf] 📤 uploaded ${fileName} → ${json.id} (${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB)`,
  );
  return json.id;
}
