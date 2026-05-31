/**
 * labelOcr — อ่าน "ป้ายรหัส" บนแบบด้วย OCR (tesseract.js) แล้ว parse เป็น mark
 * --------------------------------------------------------------------------
 * แนวทาง label-based: คลิกที่ป้าย (เช่น "F2,C2") → crop รอบจุดจาก bitmap เต็มความ
 *   ละเอียด → tesseract อ่านเป็นข้อความ → parseMarks() จับคู่เข้า KNOWN_MARKS
 *   (fuzzy — รองรับอ่านเพี้ยน) → คืน list รหัส
 *
 * ⚠️ tesseract.js โหลด worker + WASM lazy ครั้งเดียว (singleton) — ครั้งแรกช้า
 *    ให้ UI โชว์ "กำลังโหลดตัวอ่านป้าย…" (เช็คผ่าน isOcrReady())
 */
import { createWorker, PSM, type Worker } from 'tesseract.js';

/** รหัสที่ระบบรู้จัก — เพิ่มได้ (ใช้ fuzzy-match ผล OCR เข้าชุดนี้) */
export const KNOWN_MARKS: readonly string[] = [
  'F1',
  'F2',
  'C1',
  'C2',
  'C3',
  'GB1',
  'GB2',
  'GB3',
  'GS',
  'PS',
];

const OCR_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,/ ';

let workerPromise: Promise<Worker> | null = null;
let ready = false;

/** worker พร้อมใช้แล้วหรือยัง — false = ครั้งแรก (กำลังโหลด WASM) */
export function isOcrReady(): boolean {
  return ready;
}

/** init tesseract worker ครั้งเดียว (lazy) */
function ensureWorker(): Promise<Worker> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: OCR_WHITELIST,
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
    });
    ready = true;
    return worker;
  })();
  return workerPromise;
}

export interface OcrAtOptions {
  /** ขนาด canonical page-px ของหน้านี้ (แปลง page-px → bitmap-px) */
  pageWidth: number;
  pageHeight: number;
}

/**
 * อ่านป้ายรอบจุดที่คลิก → raw text
 *   - แปลง pointPagePx → bitmap-px (bitmap = ความละเอียดเต็ม)
 *   - crop กล่องรอบจุด (กว้างพออ่าน 1 ป้าย) แล้ว upscale ให้ตัวอักษรคมขึ้น
 */
export async function ocrAt(
  bitmap: HTMLCanvasElement,
  pointPagePx: { x: number; y: number },
  opts: OcrAtOptions,
): Promise<string> {
  const sx = bitmap.width / opts.pageWidth;
  const sy = bitmap.height / opts.pageHeight;
  const bx = pointPagePx.x * sx;
  const by = pointPagePx.y * sy;

  // crop region (bitmap-px) — กว้างสัมพัทธ์กับภาพ, clamp กันเล็ก/ใหญ่เกิน
  const halfW = Math.min(260, Math.max(70, Math.round(bitmap.width * 0.045)));
  const halfH = Math.round(halfW * 0.42);
  const cropX = Math.max(0, Math.round(bx - halfW));
  const cropY = Math.max(0, Math.round(by - halfH));
  const cropW = Math.min(bitmap.width - cropX, halfW * 2);
  const cropH = Math.min(bitmap.height - cropY, halfH * 2);
  if (cropW <= 0 || cropH <= 0) return '';

  // upscale 3x → ตัวอักษรใหญ่ขึ้น OCR แม่นกว่า
  const scale = 3;
  const canvas = document.createElement('canvas');
  canvas.width = cropW * scale;
  canvas.height = cropH * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    bitmap,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const worker = await ensureWorker();
  const { data } = await worker.recognize(canvas);
  return data.text ?? '';
}

/** ระยะ Levenshtein (สำหรับ fuzzy-match รหัสที่อ่านเพี้ยน) */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n]!;
}

/** รหัสที่ "มีรูปทรงถูกต้อง" — ตัวอักษร 1-3 ตัว ตามด้วยเลข 1-3 หลัก (F1, C2, GB1, …) */
const MARK_SHAPE = /^[A-Z]{1,3}\d{1,3}$/;

/**
 * จับ token เดียวเข้า KNOWN_MARKS — เข้มขึ้นเพื่อกัน junk (IY/NOZ/NZ/ST):
 *   1. exact match KNOWN_MARKS → คืนเลย (รองรับ GS/PS ที่ไม่มีเลข)
 *   2. รูปทรงถูกต้อง (ตัวอักษร+เลข เช่น F1/F3/GB2) → เชื่อตามที่อ่าน (รหัสใหม่ก็ผ่าน)
 *   3. token ตัวอักษรล้วน/ผิดรูป → fuzzy เข้า KNOWN เฉพาะ dist ≤1 · ไม่ถึง → คืน '' (ทิ้ง)
 *
 *   ⚠️ ไม่ fuzzy รหัสที่มีเลข เพื่อกัน F3→F2 (ต่างกันแค่หลักเดียวแต่เป็นคนละชิ้น)
 */
function matchMark(token: string): string {
  const t = token.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!t) return '';
  if (KNOWN_MARKS.includes(t)) return t;
  if (MARK_SHAPE.test(t)) return t;

  // token ตัวอักษรล้วน/ผิดรูป — ยอมรับเฉพาะที่ใกล้ KNOWN มาก (อ่านเพี้ยน 1 ตัว)
  let best: string | null = null;
  let bestDist = Infinity;
  for (const known of KNOWN_MARKS) {
    const d = levenshtein(t, known);
    if (d < bestDist) {
      bestDist = d;
      best = known;
    }
  }
  return best != null && bestDist <= 1 ? best : '';
}

/**
 * parse ข้อความ OCR → list รหัส
 *   - split ด้วย ','/ช่องว่าง/บรรทัด/'/'
 *   - แต่ละ token → fuzzy-match เข้า KNOWN_MARKS · ไม่ match → token ดิบ
 *   - dedupe คงลำดับ
 */
export function parseMarks(raw: string): string[] {
  const tokens = raw.split(/[\s,/\n]+/).filter((t) => t.trim().length > 0);
  const out: string[] = [];
  for (const tk of tokens) {
    const mk = matchMark(tk);
    if (mk && !out.includes(mk)) out.push(mk);
  }
  return out;
}
