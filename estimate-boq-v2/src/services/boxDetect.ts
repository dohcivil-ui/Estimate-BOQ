// src/services/boxDetect.ts
import {
  callAI,
  downsampleCanvasToDataUrl,
  type ChatMessage,
} from './aiAnalyze';
import { getEngineConfig, type AIEngine } from './aiEngines';
import {
  parseExpectedTotal,
  parsePerceptronBoxes,
  type FootingBoxNorm,
} from './perceptronBoxes';

export interface DetectedBox {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DetectResult {
  boxes: DetectedBox[];
  raw: string;
  model: string;
  elapsedMs: number;
  tokens?: { prompt_tokens?: number; completion_tokens?: number };
  /** จำนวนที่โมเดลอ้างจากบรรทัดสรุป "รวม=N" (null = ไม่มีบรรทัดสรุป) */
  expected: number | null;
}

const NORM_BASE = 1000;
const uid = (): string => crypto.randomUUID();

export const DEFAULT_DETECT_PROMPT = `นับฐานรากในแปลนฐานรากนี้แบบ grid-first ทำตามลำดับ ห้ามข้าม:
STEP 1 — Grid: นับเส้นแกนยาว (1,2,3...) = N, แกนสั้น (A,B...) = M → จุดตัด = N×M
STEP 2 — ฐานที่จุดตัด: ทุกจุดตัดมีฐาน 1 ฐาน อ่านชนิด ไล่ทุกจุดเป็น <ยาว><สั้น>:<ชนิด> เช่น 1A:F2 1B:F2 ...
STEP 3 — ฐานพิเศษนอกจุดตัด (สำคัญที่สุด):
- ฐานชนิดอื่น (เช่น F1) ที่อยู่กลางช่วง/ขอบ มักมีมากกว่า 1 ตัว — อย่าหยุดหลังเจอตัวแรก
- สแกนให้ครบทั้ง 4 ด้าน: ขอบซ้าย ขอบขวา ขอบบน ขอบล่าง และกึ่งกลางทุกแนว
- ฐานพิเศษมักวางสมมาตร — เจอฝั่งหนึ่งแล้ว ต้องเช็คฝั่งตรงข้ามเสมอ
- ไล่รายตำแหน่งของฐานพิเศษทุกตัว (เช่น ซ้ายกลาง / ขวากลาง) ห้ามสรุปจำนวนโดยไม่ระบุตำแหน่ง
- นับ "เพิ่ม" แยก ห้ามลบออกจากจำนวนจุดตัด
STEP 4 — ทวนก่อนตอบ: สแกนครบทั้ง 4 ขอบหรือยัง? ฐานพิเศษเช็คฝั่งตรงข้ามครบไหม?
STEP 5 — คืน bounding box ของทุกฐาน 1 กล่องต่อ 1 ฐาน โดย label ต้องตรงกับ STEP 2/3:
แยกเป็น <collection mention="F2"> สำหรับฐานจุดตัด และ <collection mention="F1"> สำหรับฐานพิเศษ
ห้ามยัดทุกฐานไว้ collection เดียว
ปิดท้ายด้วยสรุป: F2=? | F1=? | รวม=?`;

export async function detectBoxes(opts: {
  bitmap: HTMLCanvasElement;
  engine: AIEngine;
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
    expected: parseExpectedTotal(out.text),
  };
}
