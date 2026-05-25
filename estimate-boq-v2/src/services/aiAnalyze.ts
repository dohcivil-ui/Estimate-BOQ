/**
 * AI วิเคราะห์แบบ — Qwen via Edge Function หรือ DEV-DIRECT
 *
 * รองรับ:
 *   - 5 mode (architectural/structural/electrical/sanitary/auto)
 *   - หลายภาพอ้างอิง (referenceImages) ก่อนภาพ target
 *   - progress callback (อัปเดต UI ระหว่างรอ)
 *   - timeout 120s (HD + multi-page ใช้เวลานาน)
 *   - messages array แบบ OpenAI-compat (system + user image+text + ...)
 *
 * Resize:
 *   - target: 1500px (ปกติ) / 2400px (HD) @ jpeg 0.85
 *   - reference: 1000px @ jpeg 0.70 (ประหยัด token)
 */
import { getSupabase } from '@/lib/supabase';
import type {
  AIAnalysisResponse,
  AIDetectResult,
  AIDiscipline,
  AIMode,
  AIReferenceImage,
} from '@/types/ai';
import {
  getAutoDetectUserPrompt,
  getSystemPromptForMode,
  getUserPromptForDiscipline,
} from './aiPrompts';

const TARGET_MAX_DIM = 1500;
const TARGET_HD_MAX_DIM = 2400;
const TARGET_QUALITY = 0.85;
const REF_MAX_DIM = 1000;
const REF_QUALITY = 0.7;
const TIMEOUT_MS = 120_000;

// ─── Progress stage messages (เวลาเป็น ms) ──────────────────────────────
const PROGRESS_STAGES: Array<{ at: number; msg: string }> = [
  { at: 0, msg: '🤖 กำลังส่งภาพไป AI...' },
  { at: 10_000, msg: '⏳ AI กำลังอ่านแบบ...' },
  { at: 30_000, msg: '⏳ AI กำลังถอดปริมาณ... (ใจเย็นๆ)' },
  { at: 60_000, msg: '⏳ ภาพ HD ใช้เวลานานกว่าปกติ...' },
  { at: 90_000, msg: '⚠️ เกือบ timeout — อาจต้องลอง HD off' },
];

export type ProgressCallback = (msg: string) => void;

export interface AnalyzeOptions {
  pageId: string;
  bitmap: HTMLCanvasElement;
  mode: AIMode;
  hd?: boolean;
  /** ภาพอ้างอิง (รายการวัสดุ/สัญลักษณ์/รายละเอียดทั่วไป) — สูงสุด 3 หน้า */
  referenceImages?: AIReferenceImage[];
  /** callback อัปเดต UI ระหว่างรอ */
  onProgress?: ProgressCallback;
  projectId?: string;
}

export interface AnalyzeResult {
  discipline: AIDiscipline;
  result: AIAnalysisResponse;
  raw: string;
  model: string;
  elapsedMs: number;
  tokens?: { prompt_tokens?: number; completion_tokens?: number };
  detected?: AIDetectResult;
}

export class AutoDetectFailed extends Error {
  detected: AIDetectResult;
  constructor(detected: AIDetectResult) {
    super(
      `ไม่สามารถตรวจจับประเภทแบบ — กรุณาเลือกด้วยตนเอง (${detected.reason ?? 'ไม่มีเหตุผล'})`,
    );
    this.name = 'AutoDetectFailed';
    this.detected = detected;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Image helpers
// ═══════════════════════════════════════════════════════════════════════

export function downsampleCanvasToDataUrl(
  canvas: HTMLCanvasElement,
  maxDim: number,
  quality = TARGET_QUALITY,
): string {
  const scale = Math.min(maxDim / canvas.width, maxDim / canvas.height, 1);
  if (scale >= 1) return canvas.toDataURL('image/jpeg', quality);
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const oc = document.createElement('canvas');
  oc.width = w;
  oc.height = h;
  const ctx = oc.getContext('2d');
  if (!ctx) throw new Error('cannot get canvas context for downsample');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, w, h);
  return oc.toDataURL('image/jpeg', quality);
}

/** สร้าง reference image จาก DrawingPage bitmap */
export function buildReferenceImage(opts: {
  pageId: string;
  bitmap: HTMLCanvasElement;
  pageNum: number;
  label: string;
}): AIReferenceImage {
  return {
    pageId: opts.pageId,
    pageNum: opts.pageNum,
    label: opts.label,
    dataUrl: downsampleCanvasToDataUrl(opts.bitmap, REF_MAX_DIM, REF_QUALITY),
  };
}

function tryParseJSON(text: string): unknown | null {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fence) s = fence[1]!;
  try {
    return JSON.parse(s);
  } catch {
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      try {
        return JSON.parse(s.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function tryParseAIResponse(text: string): unknown | null {
  return tryParseJSON(text);
}

// ═══════════════════════════════════════════════════════════════════════
// Progress watcher
// ═══════════════════════════════════════════════════════════════════════

function runWithProgress<T>(
  fn: () => Promise<T>,
  onProgress?: ProgressCallback,
): Promise<T> {
  if (!onProgress) return fn();
  const startedAt = Date.now();
  // emit แรกทันที
  onProgress(PROGRESS_STAGES[0]!.msg);
  const timerId = window.setInterval(() => {
    const elapsed = Date.now() - startedAt;
    let stageMsg = PROGRESS_STAGES[0]!.msg;
    for (const s of PROGRESS_STAGES) {
      if (elapsed >= s.at) stageMsg = s.msg;
    }
    onProgress(stageMsg);
  }, 1000);
  return fn().finally(() => window.clearInterval(timerId));
}

// ═══════════════════════════════════════════════════════════════════════
// OpenAI-compat message types
// ═══════════════════════════════════════════════════════════════════════

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user' | 'assistant'; content: string | ChatContentPart[] };

// ═══════════════════════════════════════════════════════════════════════
// MAIN — analyzePage
// ═══════════════════════════════════════════════════════════════════════

export async function analyzePage(opts: AnalyzeOptions): Promise<AnalyzeResult> {
  const maxDim = opts.hd ? TARGET_HD_MAX_DIM : TARGET_MAX_DIM;
  const targetImageDataUrl = downsampleCanvasToDataUrl(opts.bitmap, maxDim);
  const refs = opts.referenceImages?.slice(0, 3) ?? [];

  let activeDiscipline: AIDiscipline;
  let detected: AIDetectResult | undefined;

  // ─── auto detect path ───────────────────────────────────────────────
  if (opts.mode === 'auto') {
    console.info('[ai] mode=auto — กำลังตรวจจับประเภทแบบ…');
    const detectStart = Date.now();
    const detectMessages: ChatMessage[] = [
      { role: 'system', content: getSystemPromptForMode('auto') },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: targetImageDataUrl } },
          { type: 'text', text: getAutoDetectUserPrompt() },
        ],
      },
    ];
    const detectRes = await callQwen(detectMessages, opts.hd ?? false);
    const parsed = tryParseJSON(detectRes.text);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(
        `AI detect ตอบไม่ใช่ JSON ที่ถูกต้อง: ${detectRes.text.slice(0, 200)}`,
      );
    }
    detected = parsed as AIDetectResult;
    console.info(
      `[ai] detect = ${detected.detected_discipline} (confidence: ${detected.confidence}) — ${((Date.now() - detectStart) / 1000).toFixed(1)}s`,
    );
    if (
      detected.detected_discipline === 'unknown' ||
      detected.confidence === 'low'
    ) {
      throw new AutoDetectFailed(detected);
    }
    activeDiscipline = detected.detected_discipline as AIDiscipline;
  } else {
    activeDiscipline = opts.mode;
  }

  // ─── full analyze ─────────────────────────────────────────────────────
  console.info(
    `[ai] วิเคราะห์ discipline=${activeDiscipline} hd=${opts.hd ?? false} refs=${refs.length}`,
  );
  const start = Date.now();

  const messages = buildAnalyzeMessages(
    activeDiscipline,
    targetImageDataUrl,
    refs,
  );
  const out = await runWithProgress(
    () => callQwen(messages, opts.hd ?? false),
    opts.onProgress,
  );

  const parsed = tryParseJSON(out.text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`AI ตอบไม่ใช่ JSON: ${out.text.slice(0, 200)}…`);
  }
  const result = parsed as AIAnalysisResponse;
  result.discipline = activeDiscipline;
  if (!Array.isArray(result.items)) result.items = [];

  const elapsedMs = Date.now() - start;
  console.info(
    `[ai] วิเคราะห์เสร็จ — items: ${result.items.length}, tokens: ${out.tokens?.prompt_tokens ?? '?'}/${out.tokens?.completion_tokens ?? '?'}, ${(elapsedMs / 1000).toFixed(1)}s`,
  );

  return {
    discipline: activeDiscipline,
    result,
    raw: out.text,
    model: out.model,
    elapsedMs,
    tokens: out.tokens,
    detected,
  };
}

/** สร้าง messages array สำหรับ analyze ครั้งแรก (รวม references) */
export function buildAnalyzeMessages(
  discipline: AIDiscipline,
  targetImageDataUrl: string,
  references: AIReferenceImage[],
): ChatMessage[] {
  const system = getSystemPromptForMode(discipline);
  const baseUserText = getUserPromptForDiscipline(discipline);

  const userContent: ChatContentPart[] = [];

  if (references.length > 0) {
    userContent.push({
      type: 'text',
      text: `📋 หน้าอ้างอิง ${references.length} หน้า — อ่านสัญลักษณ์วัสดุและรายการประกอบแบบจากหน้าเหล่านี้ก่อน:`,
    });
    for (const ref of references) {
      userContent.push({
        type: 'text',
        text: `--- หน้า ${ref.pageNum}: ${ref.label} ---`,
      });
      userContent.push({
        type: 'image_url',
        image_url: { url: ref.dataUrl },
      });
    }
    userContent.push({
      type: 'text',
      text: '\n📐 หน้าที่ต้องวิเคราะห์ (ใช้ข้อมูลจากหน้าอ้างอิงด้านบนประกอบ):',
    });
  }

  userContent.push({
    type: 'image_url',
    image_url: { url: targetImageDataUrl },
  });

  const finalText =
    baseUserText +
    (references.length > 0
      ? '\n\n⚠️ สำคัญ: ใช้ข้อมูลจากหน้าอ้างอิง (รายการวัสดุ/สัญลักษณ์) ที่ส่งมาด้านบน อย่าเดาชนิดวัสดุเอง — ถ้าสัญลักษณ์ไหนไม่มีในรายการอ้างอิง ให้ใส่ใน unreadable[] พร้อมระบุว่า "ไม่พบในรายการอ้างอิง — ต้องยืนยัน"'
      : '');
  userContent.push({ type: 'text', text: finalText });

  return [
    { role: 'system', content: system },
    { role: 'user', content: userContent },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// callQwen — รับ messages array แบบ OpenAI-compat
// ═══════════════════════════════════════════════════════════════════════

interface QwenCallResult {
  text: string;
  model: string;
  tokens?: { prompt_tokens?: number; completion_tokens?: number };
}

export async function callQwen(
  messages: ChatMessage[],
  hd: boolean,
): Promise<QwenCallResult> {
  // dev-direct (insecure) — เปิดใช้เมื่อมี VITE_QWEN_API_KEY_DEV
  const devKey = import.meta.env.VITE_QWEN_API_KEY_DEV as string | undefined;
  if (devKey && devKey.trim() && !devKey.includes('your-key-here')) {
    console.warn(
      '[ai] ⚠️ DEV-DIRECT mode active — VITE_QWEN_API_KEY_DEV exposed in browser!',
    );
    return callQwenDirect(messages, hd, devKey);
  }

  // Edge Function path: ส่ง messages array ผ่าน body
  const client = getSupabase();
  if (!client) {
    throw new Error(
      'Supabase ยังไม่ได้ตั้งค่า — ตั้ง .env.local + deploy Edge Function ตาม docs/SUPABASE_SETUP.md',
    );
  }

  // Edge fn เดิมรับ {prompt, imageDataUrl} — ใช้ fallback: flatten messages →
  // เอา system + ข้อความ user รวมเป็น prompt + ส่งภาพแรกที่เจอ
  const fallback = flattenForLegacyEdge(messages);
  const { data, error } = await client.functions.invoke('analyze-drawing', {
    body: {
      pageId: '__inline__',
      imageDataUrl: fallback.imageDataUrl,
      prompt: fallback.prompt,
      hd,
      // ถ้า Edge fn รุ่นใหม่รองรับ messages array จะใช้ field นี้
      messages,
    },
  });

  if (error) {
    throw new Error(
      `เรียก Edge Function ไม่สำเร็จ: ${error.message ?? String(error)}`,
    );
  }
  if (!data || (data as { error?: string }).error) {
    throw new Error(
      (data as { error?: string })?.error ?? 'Edge Function ตอบกลับว่างเปล่า',
    );
  }
  const ok = data as {
    raw: string;
    meta: { model: string; tokens?: QwenCallResult['tokens'] };
  };
  return { text: ok.raw, model: ok.meta.model, tokens: ok.meta.tokens };
}

async function callQwenDirect(
  messages: ChatMessage[],
  hd: boolean,
  apiKey: string,
): Promise<QwenCallResult> {
  const endpoint =
    (import.meta.env.VITE_QWEN_ENDPOINT_DEV as string | undefined) ??
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  const model =
    (import.meta.env.VITE_QWEN_MODEL_DEV as string | undefined) ??
    (hd ? 'qwen-vl-max' : 'qwen3.5-flash');

  // เก็บสถิติ
  const totalChars = estimatePromptChars(messages);
  console.info(`[ai] prompt total chars: ${totalChars}`);

  const ctrl = new AbortController();
  const timeoutId = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Qwen API ${res.status}: ${txt.slice(0, 500)}`);
    }
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? '';
    return { text, model, tokens: json.usage };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `⏱️ AI ใช้เวลาเกิน 2 นาที — ลอง:\n• ปิด HD\n• ลดจำนวนหน้าอ้างอิง\n• เลือก mode เฉพาะแทน อัตโนมัติ`,
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function estimatePromptChars(messages: ChatMessage[]): number {
  let n = 0;
  for (const m of messages) {
    if (typeof m.content === 'string') n += m.content.length;
    else {
      for (const c of m.content) {
        if (c.type === 'text') n += c.text.length;
        else n += 1000; // ประมาณ overhead ของรูป (ไม่นับ base64)
      }
    }
  }
  return n;
}

/** flatten messages → legacy Edge fn payload (1 image + 1 prompt) */
function flattenForLegacyEdge(messages: ChatMessage[]): {
  prompt: string;
  imageDataUrl: string;
} {
  const sysParts: string[] = [];
  const userParts: string[] = [];
  let firstImage: string | null = null;

  for (const m of messages) {
    if (m.role === 'system' && typeof m.content === 'string') {
      sysParts.push(m.content);
    } else if (m.role === 'user') {
      if (typeof m.content === 'string') {
        userParts.push(m.content);
      } else {
        for (const c of m.content) {
          if (c.type === 'text') userParts.push(c.text);
          else if (c.type === 'image_url' && !firstImage) {
            firstImage = c.image_url.url;
          }
        }
      }
    }
  }

  return {
    prompt: [...sysParts, '## งาน', ...userParts].join('\n\n'),
    imageDataUrl: firstImage ?? '',
  };
}
