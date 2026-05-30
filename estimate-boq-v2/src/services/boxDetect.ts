// src/services/boxDetect.ts
// ───────────────────────────────────────────────────────────────────────
// Perceptron box-detection path — แยกจาก flow BOQ (analyzePage)
//
// เหตุผลที่ต้องแยก:
//   - Perceptron ctx แค่ 33K → ใช้ system prompt กฎ 1-15 ไม่ได้ (ล้น)
//   - Perceptron คืน markup <point_box> ไม่ใช่ JSON → ผ่าน callAIExpectingJSONObject ไม่ได้
//
// flow: prompt สั้น → callAI() ตรง (edge เติม annotation_format:"box" เอง) → parsePerceptronBoxes
//   → แปลง normalized 0-1000 → page coords (พิกัดเดียวกับ measurement → ใช้ transform เดิมวาดได้)
// ───────────────────────────────────────────────────────────────────────
import {
  callAI,
  downsampleCanvasToDataUrl,
  type ChatMessage,
} from './aiAnalyze';
import { getEngineConfig, type AIEngine } from './aiEngines';
import { parsePerceptronBoxes, type FootingBoxNorm } from './perceptronBoxes';

export interface DetectedBox {
  id: string;
  type: string; // "F2" | "F1" | ...
  // page coordinates (พิกัดรูปจริง frozen @ import — เดียวกับ measurement points)
  x: number;
  y: number; // มุมบนซ้าย
  w: number;
  h: number;
}

export interface DetectResult {
  boxes: DetectedBox[];
  raw: string;
  model: string;
  elapsedMs: number;
  tokens?: { prompt_tokens?: number; completion_tokens?: number };
}

const NORM_BASE = 1000; // Perceptron normalize 0–1000 ต่อแกน (ยืนยันจาก overlay test)
const uid = (): string => crypto.randomUUID();

// prompt สั้น (พอดี ctx 33K) — grid-first + คืน box (ค่า default; ส่ง custom ได้)
export const DEFAULT_DETECT_PROMPT = `นับฐานรากในแปลนฐานรากนี้แบบ grid-first แล้วคืน bounding box ของทุกฐาน:
STEP 1 — Grid: เส้นแกนยาว(1,2,3...) = N, แกนสั้น(A,B...) = M → จุดตัด = N×M
STEP 2 — ฐานที่จุดตัด: ทุกจุดตัดมีฐาน 1 ฐาน อ่านชนิด (เช่น F2)
STEP 3 — ฐานพิเศษ (F1) นอกจุดตัด: สแกนครบ 4 ด้าน เจอฝั่งหนึ่งต้องเช็คฝั่งตรงข้าม นับเพิ่มแยก ห้ามลบออกจากจุดตัด
STEP 4 — คืน bounding box: 1 กล่องต่อ 1 ฐาน (ทั้ง F2 และ F1) แต่ละกล่องแนบ label ชนิดฐาน + ตำแหน่ง grid
ตอบ: F2=? | F1=? | รวม=? พร้อมพิกัดกล่องของทุกฐาน`;

export async function detectBoxes(opts: {
  bitmap: HTMLCanvasElement;
  engine: AIEngine; // ควรเป็น 'perceptron'
  hd?: boolean;
  prompt?: string;
  onProgress?: (msg: string) => void;
}): Promise<DetectResult> {
  const config = getEngineConfig(opts.engine);
  const maxDim = opts.hd ? config.maxImageDimHD : config.maxImageDim;
  const imageDataUrl = downsampleCanvasToDataUrl(
    opts.bitmap,
    maxDim,
    config.imageQuality,
  );

  // ❗ ไม่มี system prompt ใหญ่ — แค่ user message สั้น + รูป (กัน ctx 33K ล้น)
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text: opts.prompt?.trim() || DEFAULT_DETECT_PROMPT },
      ],
    },
  ];

  const start = Date.now();
  const out = await callAI(messages, opts.engine, opts.hd ?? false, {
    onProgress: opts.onProgress,
  });

  // page dims = ขนาด bitmap (พิกัดรูปจริง) — normalized 0-1000 map เป็นสัดส่วนของรูปเต็ม
  const W = opts.bitmap.width;
  const H = opts.bitmap.height;

  const norm = parsePerceptronBoxes(out.text);
  const boxes: DetectedBox[] = norm.map((b: FootingBoxNorm) => ({
    id: uid(),
    type: b.type,
    x: (b.nx1 / NORM_BASE) * W,
    y: (b.ny1 / NORM_BASE) * H,
    w: ((b.nx2 - b.nx1) / NORM_BASE) * W,
    h: ((b.ny2 - b.ny1) / NORM_BASE) * H,
  }));

  return {
    boxes,
    raw: out.text,
    model: out.model,
    elapsedMs: Date.now() - start,
    tokens: out.tokens,
  };
}
