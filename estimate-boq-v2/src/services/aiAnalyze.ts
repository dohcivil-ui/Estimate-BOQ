/**
 * AI วิเคราะห์แบบ — ยิงผ่าน Supabase Edge Function `analyze` เท่านั้น
 *
 * รองรับ:
 *   - 5 mode (architectural/structural/electrical/sanitary/auto)
 *   - หลายภาพอ้างอิง (referenceImages) ก่อนภาพ target
 *   - progress callback (spinner ระหว่างรอ — edge ตอบทีเดียว ไม่ stream)
 *
 * ❗ ไม่มี browser-direct provider call แล้ว — system prompt (กฎ 1–15) ส่งเป็น
 *   body.system แยก เพื่อให้ฝั่ง edge (Anthropic) cache ได้
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
import { getEngineConfig, type AIEngine } from './aiEngines';
import { categoryForMark, type MarkDims } from '@/stores/detectionStore';

// ─── Progress stage messages (เวลาเป็น ms) ──────────────────────────────
const PROGRESS_STAGES: Array<{ at: number; msg: string }> = [
  { at: 0, msg: '🤖 กำลังส่งภาพไป AI...' },
  { at: 10_000, msg: '⏳ AI กำลังอ่านแบบ... (~30–60 วิ)' },
  { at: 30_000, msg: '⏳ AI กำลังถอดปริมาณ... (ใจเย็นๆ)' },
  { at: 60_000, msg: '⏳ ภาพ HD ใช้เวลานานกว่าปกติ...' },
  { at: 90_000, msg: '⚠️ ใช้เวลานาน — อาจต้องลอง HD off' },
];

export type ProgressCallback = (msg: string) => void;

export interface AnalyzeOptions {
  pageId: string;
  bitmap: HTMLCanvasElement;
  engine: AIEngine;
  mode: AIMode;
  hd?: boolean;
  /** ภาพอ้างอิง (รายการวัสดุ/สัญลักษณ์/รายละเอียดทั่วไป) — สูงสุด 4 หน้า */
  referenceImages?: AIReferenceImage[];
  /**
   * Override prompt ที่ส่งใน user message — ถ้า user แก้ prompt textarea
   * (default: getUserPromptForDiscipline(discipline))
   */
  customUserPrompt?: string;
  /**
   * บล็อก "จำนวนจริงจาก tag" ที่แอปประกอบจาก marker บนหน้า — prepend ก่อน task
   * อัตโนมัติ (แยกจาก customUserPrompt เพื่อให้แนบเสมอแม้ user แก้ prompt)
   */
  tagTally?: string;
  /** callback อัปเดต UI ระหว่างรอ */
  onProgress?: ProgressCallback;
  projectId?: string;
}

export interface AnalyzeResult {
  discipline: AIDiscipline;
  result: AIAnalysisResponse;
  raw: string;
  model: string;
  engine: AIEngine;
  elapsedMs: number;
  tokens?: { prompt_tokens?: number; completion_tokens?: number };
  detected?: AIDetectResult;
  /** true = คำตอบโดน max_tokens ตัด (finish_reason=length) — อาจถอดไม่ครบ */
  truncated?: boolean;
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
  quality = 0.85,
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
  engine: AIEngine;
}): AIReferenceImage {
  const config = getEngineConfig(opts.engine);
  return {
    pageId: opts.pageId,
    pageNum: opts.pageNum,
    label: opts.label,
    dataUrl: downsampleCanvasToDataUrl(
      opts.bitmap,
      config.refImageDim,
      config.refImageQuality,
    ),
  };
}

/**
 * ทำความสะอาด text จาก AI ก่อน JSON.parse
 *  - ตัด whitespace นอก
 *  - ลอก markdown code fence (```json ... ``` หรือ ``` ... ```)
 *  - ถ้ายังมี prefix/suffix ที่ไม่ใช่ JSON ให้เฉือนระหว่าง { ตัวแรก ... } ตัวสุดท้าย
 *
 * export ออกมาเพื่อให้ aiChat.ts (และ caller อื่น) import ใช้ก่อน JSON.parse ได้
 */
export function cleanJsonResponse(text: string): string {
  let s = text.trim();

  const fenceMatch = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fenceMatch) {
    s = fenceMatch[1]!.trim();
  } else {
    s = s
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
  }

  if (s.toLowerCase().startsWith('json\n')) {
    s = s.slice(5).trim();
  }

  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    s = s.substring(start, end + 1);
  }

  return s;
}

function tryJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractFirstBalancedJSON(text: string): string | null {
  const starts = [text.indexOf('{'), text.indexOf('[')].filter((x) => x >= 0);
  if (starts.length === 0) return null;
  const start = Math.min(...starts);

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch);
      continue;
    }
    if (ch === '}' || ch === ']') {
      const top = stack[stack.length - 1];
      if (!top) return null;
      if ((ch === '}' && top !== '{') || (ch === ']' && top !== '[')) {
        return null;
      }
      stack.pop();
      if (stack.length === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function looksLikeTruncatedJSON(text: string): boolean {
  const s = cleanJsonResponse(text);
  if (!s.includes('{') && !s.includes('[')) return false;
  return extractFirstBalancedJSON(s) === null;
}

function tryParseJSON(text: string): unknown | null {
  const normalized = cleanJsonResponse(text);

  const direct = tryJsonParse(normalized);
  if (direct !== null) {
    // บาง engine ส่ง JSON ซ้อนเป็น string อีกชั้น
    if (typeof direct === 'string') {
      const nested = tryJsonParse(cleanJsonResponse(direct));
      if (nested !== null) return nested;
    }
    return direct;
  }

  // กรณี JSON ถูก truncate — ตัดเอาเฉพาะ object แรกที่ balanced
  const balanced = extractFirstBalancedJSON(normalized);
  if (balanced) {
    const parsed = tryJsonParse(balanced);
    if (parsed !== null) return parsed;
  }

  return null;
}

export function tryParseAIResponse(text: string): unknown | null {
  return tryParseJSON(text);
}

const JSON_RETRY_PROMPT = `⚠️ คำตอบก่อนหน้าไม่เป็น JSON ที่ parse ได้ หรือถูกตัดกลางทาง

ตอบใหม่ทั้งหมดให้เป็น JSON object เดียวที่สมบูรณ์และปิดวงเล็บครบ โดย:
- กระชับสุด ๆ ไม่ต้องอธิบาย description ยาว
- จำกัด items[] ไม่เกิน 25 รายการ (รวม category ที่ใกล้กันให้เป็น item เดียว)
- เก็บแต่ฟิลด์สำคัญ: category, name, quantity, unit, source, confidence
- ละ materials[]/sub_items[]/accessories[]/labor ที่ซับซ้อนหรือซ้ำ ๆ ออกไป (เก็บไว้แค่อันที่จำเป็น)
- ห้ามมี markdown code fence หรือข้อความนอก JSON`;

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
// OpenAI-compat message types (ใช้ภายใน frontend ก่อน flatten ส่ง edge)
// ═══════════════════════════════════════════════════════════════════════

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user' | 'assistant'; content: string | ChatContentPart[] };

async function callAIExpectingJSONObject(opts: {
  messages: ChatMessage[];
  engine: AIEngine;
  hd: boolean;
  onProgress?: ProgressCallback;
  retryMessage?: string;
  phaseLabel: 'detect' | 'analyze';
}): Promise<{ parsed: Record<string, unknown>; out: AICallResult }> {
  let out = await callAI(opts.messages, opts.engine, opts.hd, {
    onProgress: opts.onProgress,
  });
  let parsed = tryParseJSON(out.text);
  if (parsed && typeof parsed === 'object') {
    return { parsed: parsed as Record<string, unknown>, out };
  }

  // วินิจฉัยสาเหตุที่ parse ไม่ผ่าน → เลือก retry strategy ที่เหมาะสม
  const truncated =
    out.finishReason === 'length' || looksLikeTruncatedJSON(out.text);
  const retryNote = truncated
    ? '🔁 คำตอบโดน max_tokens ตัด — ขอ AI ตอบใหม่แบบกระชับ...'
    : '🔁 AI กำลังจัดรูปแบบ JSON ใหม่...';
  opts.onProgress?.(retryNote);

  const retryMessages: ChatMessage[] = [
    ...opts.messages,
    { role: 'user', content: opts.retryMessage ?? JSON_RETRY_PROMPT },
  ];
  out = await callAI(retryMessages, opts.engine, opts.hd, {
    onProgress: opts.onProgress,
  });
  parsed = tryParseJSON(out.text);
  if (parsed && typeof parsed === 'object') {
    return { parsed: parsed as Record<string, unknown>, out };
  }

  // ยังไม่ผ่าน — โยน error พร้อมข้อมูล diagnostic
  const reason = out.finishReason ? ` (finish_reason=${out.finishReason})` : '';
  const truncHint =
    out.finishReason === 'length' || looksLikeTruncatedJSON(out.text)
      ? ' คำตอบถูกตัดกลางทาง — ลองปิด HD หรือลดจำนวนหน้าอ้างอิง'
      : '';
  const prefix = opts.phaseLabel === 'detect' ? 'AI detect' : 'AI';
  throw new Error(
    `${prefix} ตอบไม่ใช่ JSON ที่ถูกต้อง${reason}.${truncHint}\nตัวอย่าง: ${out.text.slice(0, 350)}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN — analyzePage
// ═══════════════════════════════════════════════════════════════════════

export async function analyzePage(opts: AnalyzeOptions): Promise<AnalyzeResult> {
  const config = getEngineConfig(opts.engine);
  const maxDim = opts.hd ? config.maxImageDimHD : config.maxImageDim;

  const targetImageDataUrl = downsampleCanvasToDataUrl(
    opts.bitmap,
    maxDim,
    config.imageQuality,
  );
  const refs = opts.referenceImages?.slice(0, 4) ?? [];

  let activeDiscipline: AIDiscipline;
  let detected: AIDetectResult | undefined;

  // ─── auto detect path ───────────────────────────────────────────────
  if (opts.mode === 'auto') {
    console.info(
      `[ai] Engine: ${config.label} | Mode: auto | HD: ${opts.hd ?? false}`,
    );
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
    const detectOut = await callAIExpectingJSONObject({
      messages: detectMessages,
      engine: opts.engine,
      hd: opts.hd ?? false,
      phaseLabel: 'detect',
      retryMessage:
        'คำตอบก่อนหน้า parse ไม่ได้ กรุณาตอบใหม่เป็น JSON object เดียวตาม schema detect',
    });
    detected = detectOut.parsed as unknown as AIDetectResult;
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
    `[ai] Engine: ${config.label} | Mode: ${activeDiscipline} | HD: ${opts.hd ?? false} | refs=${refs.length}`,
  );
  const start = Date.now();

  const messages = buildAnalyzeMessages(
    activeDiscipline,
    targetImageDataUrl,
    refs,
    opts.customUserPrompt,
    opts.tagTally,
  );
  const out = await runWithProgress(
    () =>
      callAIExpectingJSONObject({
        messages,
        engine: opts.engine,
        hd: opts.hd ?? false,
        onProgress: opts.onProgress,
        phaseLabel: 'analyze',
      }),
    opts.onProgress,
  );

  const result = out.parsed as unknown as AIAnalysisResponse;
  result.discipline = activeDiscipline;
  if (!Array.isArray(result.items)) result.items = [];

  // truncation guard — คำตอบโดน max_tokens ตัด (edge normalize → finishReason='length')
  const truncated = out.out.finishReason === 'length';
  if (truncated) {
    console.warn('[ai] ⚠️ Response ถูกตัด (max_tokens) — อาจถอดไม่ครบ');
  }

  const elapsedMs = Date.now() - start;
  console.info(
    `[ai] ✅ วิเคราะห์เสร็จ — items: ${result.items.length} | tokens: ${fmtTokens(out.out.tokens?.prompt_tokens)}/${fmtTokens(out.out.tokens?.completion_tokens)} | ${(elapsedMs / 1000).toFixed(1)}s`,
  );

  return {
    discipline: activeDiscipline,
    result,
    raw: out.out.text,
    model: out.out.model,
    engine: opts.engine,
    elapsedMs,
    tokens: out.out.tokens,
    detected,
    truncated,
  };
}

/** สร้าง messages array สำหรับ analyze ครั้งแรก (รวม references)
 *
 *  ทุกภาพ (target + reference) ส่งเป็น image (JPEG downsample) — portable ทุก provider
 */
export function buildAnalyzeMessages(
  discipline: AIDiscipline,
  targetImageDataUrl: string,
  references: AIReferenceImage[],
  customUserPrompt?: string,
  tagTally?: string,
): ChatMessage[] {
  const system = getSystemPromptForMode(discipline);
  const trimmed = customUserPrompt?.trim();
  const task =
    trimmed && trimmed.length > 0
      ? trimmed
      : getUserPromptForDiscipline(discipline);
  // จำนวนจาก tag (ถ้ามี) แนบนำหน้า task เสมอ — ทั้ง Anthropic + OpenRouter
  //   ผ่าน buildEdgePayload เส้นเดียว
  const tally = tagTally?.trim();
  const baseUserText =
    tally && tally.length > 0 ? `${tally}\n\n${task}` : task;

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

  const totalImages = references.length + 1;
  const finalText =
    baseUserText +
    (references.length > 0
      ? `\n\n⚠️ สำคัญ — ลำดับภาพที่แนบมา (${totalImages} ใบ): ภาพที่ 1–${references.length} = "หน้าอ้างอิง/Detail" (เช่น Footing Schedule, Column Schedule, รายการวัสดุ) · ภาพสุดท้าย (ใบที่ ${totalImages}) = "หน้าหลักที่ต้องวิเคราะห์". อ่านมิติ/เหล็ก/สัญลักษณ์จากหน้าอ้างอิงมาประกอบ — มี Detail ครบในภาพอ้างอิงแล้ว อย่าตอบว่า "ไม่มี Detail". ถ้าสัญลักษณ์ไหนไม่มีในรายการอ้างอิงจริง ให้ใส่ใน unreadable[] พร้อมระบุว่า "ไม่พบในรายการอ้างอิง — ต้องยืนยัน"`
      : '');
  userContent.push({ type: 'text', text: finalText });

  return [
    { role: 'system', content: system },
    { role: 'user', content: userContent },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// callAI — flatten messages → Edge Function `analyze`
// ═══════════════════════════════════════════════════════════════════════

interface AICallResult {
  text: string;
  model: string;
  tokens?: { prompt_tokens?: number; completion_tokens?: number };
  finishReason?: string;
}

interface CallAIOptions {
  onProgress?: ProgressCallback;
}

const tokenFmt = new Intl.NumberFormat('en-US');
function fmtTokens(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '?';
  return tokenFmt.format(n);
}

/**
 * flatten messages (OpenAI-compat) → payload ของ edge
 *  - system: รวมทุก role:system (กฎ 1–15) → ส่งเป็น body.system (Anthropic cache ได้)
 *  - images: รวม image_url data URL ทุกใบ (reference ก่อน target)
 *  - prompt: รวม text ของ user/assistant turn (assistant ใส่ป้ายกำกับ — เก็บ context chat)
 */
function buildEdgePayload(messages: ChatMessage[]): {
  system: string;
  prompt: string;
  images: string[];
} {
  const systemParts: string[] = [];
  const promptParts: string[] = [];
  const images: string[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      if (typeof m.content === 'string' && m.content.trim()) {
        systemParts.push(m.content);
      }
      continue;
    }
    const label = m.role === 'assistant' ? '[AI ตอบก่อนหน้า]\n' : '';
    if (typeof m.content === 'string') {
      if (m.content.trim()) promptParts.push(label + m.content);
      continue;
    }
    const texts: string[] = [];
    for (const c of m.content) {
      if (c.type === 'text') texts.push(c.text);
      else images.push(c.image_url.url);
    }
    const joined = texts.join('\n');
    if (joined.trim()) promptParts.push(label + joined);
  }

  return {
    system: systemParts.join('\n\n'),
    prompt: promptParts.join('\n\n'),
    images,
  };
}

export async function callAI(
  messages: ChatMessage[],
  engine: AIEngine,
  hd: boolean,
  options: CallAIOptions = {},
): Promise<AICallResult> {
  const config = getEngineConfig(engine);
  const client = getSupabase();
  if (!client) {
    throw new Error(
      'ยังไม่ได้เชื่อมต่อ Supabase — ต้อง login ก่อนใช้ AI (API key อยู่ฝั่ง server)',
    );
  }

  const { system, prompt, images } = buildEdgePayload(messages);
  if (images.length === 0) {
    throw new Error('ไม่มีภาพแบบส่งไป AI');
  }

  // ── ยืนยันก่อนส่ง edge: ภาพทั้งหมด = N (อ้างอิงมาก่อน + หน้าหลักท้ายสุด) ──
  console.info(
    `[ai] → ${config.provider}/${config.model} | images=${images.length} | system=${system.length}ch | prompt=${prompt.length}ch`,
  );

  options.onProgress?.('🤖 กำลังส่งให้ AI…');

  const { data, error } = await client.functions.invoke('analyze', {
    body: {
      pageId: '__inline__',
      images,
      prompt,
      system,
      hd,
      provider: config.provider,
      model: config.model,
    },
  });

  if (error) {
    throw new Error(
      `เรียก Edge Function ไม่สำเร็จ: ${error.message ?? String(error)}`,
    );
  }
  const res = data as {
    raw?: string;
    error?: string;
    meta?: {
      model?: string;
      tokens?: AICallResult['tokens'];
      finishReason?: string;
    };
  } | null;
  if (!res || res.error) {
    throw new Error(res?.error ?? 'Edge Function ตอบกลับว่างเปล่า');
  }

  return {
    text: res.raw ?? '',
    model: res.meta?.model ?? config.model,
    tokens: res.meta?.tokens,
    finishReason: res.meta?.finishReason,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// analyzeDimensions — "อ่านมิติอย่างเดียว" (Phase 1)
//   call แยกจาก analyzePage: ไม่นับ tag (count ยังมาจาก tag ในแอป)
//   อ่านแบบขยาย/schedule ที่แนบ → คืนมิติต่อ mark → map เข้า markDims
// ═══════════════════════════════════════════════════════════════════════

export interface DimsReadResult {
  /** mark ที่อ่านครบ field → พร้อม setMarkDim(mark, dims, 'ai') */
  dims: Record<string, MarkDims>;
  /** mark ที่อ่านไม่ชัด/ไม่ครบ — ไม่ set, เก็บเหตุผล */
  unreadable: { mark: string; reason: string }[];
  /** raw response ก่อน parse (log/debug) */
  raw: string;
  model: string;
}

const DIMS_SYSTEM_PROMPT = `คุณคือผู้ช่วยวิศวกรโยธาที่ "ถอดมิติ" จากแบบขยาย/ตาราง schedule ของงานโครงสร้างเท่านั้น

งานเดียวของคุณ:
- อ่านมิติของ mark ที่ผู้ใช้ระบุ จากภาพแบบขยาย/ตารางที่แนบมา แล้วคืนเป็น JSON ล้วน

ข้อห้ามเด็ดขาด:
- ห้ามนับจำนวนชิ้น/จำนวน tag (จำนวนแอปนับเองจากผังแล้ว — ไม่ใช่งานของคุณ)
- ห้ามเดามิติ ถ้าอ่านไม่ชัด/ไม่พบในแบบ → ใส่ใน unreadable[] พร้อมเหตุผลสั้น ๆ
- ห้ามตอบ markdown / คำอธิบาย — ตอบ JSON object ล้วนเท่านั้น

หน่วย:
- ความยาว/ความกว้าง/ความหนา/ความลึก เป็น "เมตร" (เช่น 1.50)
- ขนาดลวด mesh (meshWireMM) เป็น "มิลลิเมตร"`;

/** map JSON object ดิบ → MarkDims ตาม kind (เชื่อ category ของ mark ไม่ใช่ kind ที่ AI ส่งมา) */
function coerceMarkDims(
  mark: string,
  raw: unknown,
): { dims: MarkDims } | { reason: string } {
  if (!raw || typeof raw !== 'object') {
    return { reason: 'AI ไม่ส่งข้อมูลมิติของ mark นี้' };
  }
  const o = raw as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
  };
  const text = (v: unknown): string =>
    typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';

  const cat = categoryForMark(mark);

  if (cat === 'footing') {
    const W = num(o.W);
    const L = num(o.L);
    const T = num(o.T);
    const rebar = text(o.rebar);
    const tieRebar = text(o.tieRebar);
    // depth (ก้นหลุม) ไม่ขอจาก AI — เป็นผลบวกของมิติ โค้ดคำนวณเอง
    if (W == null || L == null || T == null || !rebar) {
      return { reason: 'มิติฐานรากไม่ครบ (ต้องมี W,L,T,rebar)' };
    }
    return {
      dims: {
        kind: 'footing',
        W,
        L,
        T,
        rebar,
        ...(tieRebar ? { tieRebar } : {}),
      },
    };
  }

  if (cat === 'column') {
    const W = num(o.W);
    const L = num(o.L);
    const H = num(o.H);
    const vBars = text(o.vBars);
    const tie = text(o.tie);
    if (W == null || L == null || H == null || !vBars || !tie) {
      return { reason: 'มิติเสาไม่ครบ (ต้องมี W,L,H,vBars,tie)' };
    }
    return { dims: { kind: 'column', W, L, H, vBars, tie } };
  }

  if (cat === 'beam') {
    const W = num(o.W);
    const H = num(o.H);
    const mainBars = text(o.mainBars);
    const stirrup = text(o.stirrup);
    const piecesRaw = Array.isArray(o.pieces) ? o.pieces : [];
    const pieces: { length: number; count: number }[] = [];
    for (const p of piecesRaw) {
      if (!p || typeof p !== 'object') continue;
      const pr = p as Record<string, unknown>;
      const length = num(pr.length);
      const count = num(pr.count);
      if (length != null && count != null) {
        pieces.push({ length, count: Math.round(count) });
      }
    }
    if (W == null || H == null || !mainBars || !stirrup) {
      return { reason: 'มิติคานไม่ครบ (ต้องมี W,H,mainBars,stirrup)' };
    }
    // pieces ว่างได้ (ความยาว/จำนวนต่อ span อาจกรอกเองทีหลัง) — แต่ต้องมี cross-section
    return { dims: { kind: 'beam', W, H, pieces, mainBars, stirrup } };
  }

  if (cat === 'slab') {
    const areaSqm = num(o.areaSqm);
    const thickness = num(o.thickness);
    const meshWireMM = num(o.meshWireMM);
    const meshSpacing = num(o.meshSpacing);
    const sandThk = num(o.sandThk);
    if (
      areaSqm == null ||
      thickness == null ||
      meshWireMM == null ||
      meshSpacing == null
    ) {
      return {
        reason: 'มิติพื้นไม่ครบ (ต้องมี areaSqm,thickness,meshWireMM,meshSpacing)',
      };
    }
    return {
      dims: {
        kind: 'slab',
        areaSqm,
        thickness,
        meshWireMM,
        meshSpacing,
        ...(sandThk != null ? { sandThk } : {}),
      },
    };
  }

  return { reason: `ไม่ทราบหมวดของ mark "${mark}" — ระบุมิติเองในฟอร์ม` };
}

export async function analyzeDimensions(opts: {
  marks: string[];
  references: AIReferenceImage[];
  engine: AIEngine;
  hd?: boolean;
  onProgress?: ProgressCallback;
}): Promise<DimsReadResult> {
  const marks = Array.from(
    new Set(opts.marks.map((m) => m.trim().toUpperCase()).filter(Boolean)),
  );
  if (marks.length === 0) {
    throw new Error('ไม่มี mark ให้ AI อ่านมิติ — ปักหมุด mark ก่อน');
  }
  if (opts.references.length === 0) {
    throw new Error(
      'ต้องแนบหน้าแบบขยาย/schedule (เลือกหน้าอ้างอิงก่อน) — ไม่งั้น AI ไม่มีมิติให้อ่าน',
    );
  }

  const userText = `mark ที่ต้องอ่านมิติ: ${marks.join(', ')}

คืน JSON object: key = ชื่อ mark, value = ออบเจกต์มิติตาม shape ของหมวดนั้น
  footing → {"kind":"footing","W":number,"L":number,"T":number,"rebar":"เช่น 16-DB12","tieRebar":"เช่น RB9@0.20 ถ้ามี"}
  column  → {"kind":"column","W":number,"L":number,"H":number,"vBars":"เช่น 4-DB12","tie":"เช่น RB9@0.15"}
  beam    → {"kind":"beam","W":number,"H":number,"pieces":[{"length":number,"count":number}],"mainBars":"...","stirrup":"..."}
  slab    → {"kind":"slab","areaSqm":number,"thickness":number,"meshWireMM":number,"meshSpacing":number,"sandThk":number}

⚠️ ฐานราก: อย่าอ่าน/อย่าคืน "ระดับก้นหลุม/depth" — โปรแกรมคำนวณเอง · tieRebar (เหล็กรัดรอบ) ใส่เฉพาะถ้ามีในแบบ ไม่มีก็ข้าม
mark ที่อ่านไม่ชัด/ไม่พบในแบบ → ใส่ใน "unreadable": [{"mark":"...","reason":"..."}] อย่าเดา

ตัวอย่างรูปแบบคำตอบ:
{"F2":{"kind":"footing","W":1.50,"L":1.50,"T":0.35,"rebar":"16-DB12","tieRebar":"RB9@0.20"},"unreadable":[{"mark":"GS","reason":"ไม่พบในตาราง"}]}`;

  const userContent: ChatContentPart[] = [
    {
      type: 'text',
      text: `📋 แบบขยาย/ตาราง schedule ${opts.references.length} หน้า — อ่านมิติจากหน้าเหล่านี้:`,
    },
  ];
  for (const ref of opts.references) {
    userContent.push({
      type: 'text',
      text: `--- หน้า ${ref.pageNum}: ${ref.label} ---`,
    });
    userContent.push({ type: 'image_url', image_url: { url: ref.dataUrl } });
  }
  userContent.push({ type: 'text', text: userText });

  const messages: ChatMessage[] = [
    { role: 'system', content: DIMS_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];

  // ── log-first (Phase 1 บังคับ): จำนวนภาพ + หน้าที่ส่ง ──
  console.info(
    `[ai-dims] → ส่ง ${opts.references.length} ภาพ | หน้า: ${opts.references
      .map((r) => r.pageNum)
      .join(', ')} | marks: ${marks.join(', ')}`,
  );

  const out = await callAI(messages, opts.engine, opts.hd ?? false, {
    onProgress: opts.onProgress,
  });

  // ── log-first: raw response ก่อน parse ──
  console.info('[ai-dims] ← raw response:', out.text);

  const parsed = tryParseAIResponse(out.text);
  const dims: Record<string, MarkDims> = {};
  const unreadable: { mark: string; reason: string }[] = [];

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(
      `AI ตอบไม่ใช่ JSON ที่อ่านได้\nตัวอย่าง: ${out.text.slice(0, 300)}`,
    );
  }
  const obj = parsed as Record<string, unknown>;

  // 1) รวม unreadable ที่ AI ส่งมาเอง
  const aiUnreadable = obj.unreadable;
  const aiUnreadableMarks = new Set<string>();
  if (Array.isArray(aiUnreadable)) {
    for (const u of aiUnreadable) {
      if (!u || typeof u !== 'object') continue;
      const ur = u as Record<string, unknown>;
      const m = typeof ur.mark === 'string' ? ur.mark.trim().toUpperCase() : '';
      if (!m) continue;
      aiUnreadableMarks.add(m);
      unreadable.push({
        mark: m,
        reason:
          typeof ur.reason === 'string' && ur.reason.trim()
            ? ur.reason.trim()
            : 'AI อ่านไม่ชัด',
      });
    }
  }

  // 2) coerce แต่ละ mark ที่ขอ — เชื่อ category ของ mark ไม่ใช่ kind ที่ AI ส่ง
  for (const mark of marks) {
    if (aiUnreadableMarks.has(mark)) continue;
    const entry = obj[mark];
    if (entry === undefined) {
      unreadable.push({ mark, reason: 'AI ไม่ส่งมิติของ mark นี้' });
      continue;
    }
    const r = coerceMarkDims(mark, entry);
    if ('dims' in r) dims[mark] = r.dims;
    else unreadable.push({ mark, reason: r.reason });
  }

  return { dims, unreadable, raw: out.text, model: out.model };
}
