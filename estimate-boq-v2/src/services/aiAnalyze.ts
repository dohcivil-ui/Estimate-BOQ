/**
 * AI วิเคราะห์แบบ — Gemini/Qwen via Edge Function หรือ DEV-DIRECT
 *
 * รองรับ:
 *   - 5 mode (architectural/structural/electrical/sanitary/auto)
 *   - หลายภาพอ้างอิง (referenceImages) ก่อนภาพ target
 *   - progress callback (อัปเดต UI ระหว่างรอ)
 *   - timeout 120s (HD + multi-page ใช้เวลานาน)
 *   - messages array แบบ OpenAI-compat (system + user image+text + ...)
 *
 * Resize:
 *   - target/reference ใช้ค่าจาก aiEngines.ts ตาม engine ที่เลือก
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
import {
  getEngineConfig,
  type AIEngine,
  type AIEngineConfig,
} from './aiEngines';
import { getPdfPageSource, type PdfDocSource } from './aiPdfDoc';

// ─── Progress stage messages (เวลาเป็น ms) ──────────────────────────────
const PROGRESS_STAGES: Array<{ at: number; msg: string }> = [
  { at: 0, msg: '🤖 กำลังส่งภาพไป AI...' },
  { at: 10_000, msg: '⏳ AI กำลังอ่านแบบ...' },
  { at: 30_000, msg: '⏳ AI กำลังถอดปริมาณ... (ใจเย็นๆ)' },
  { at: 60_000, msg: '⏳ ภาพ HD ใช้เวลานานกว่าปกติ...' },
  { at: 90_000, msg: '⚠️ เกือบ timeout — อาจต้องลอง HD off' },
];

export type ProgressCallback = (msg: string) => void;

/**
 * PDF page source สำหรับ Anthropic Direct (document content block)
 *  - fileId + pageNum ใช้ทำ cache key (ดู aiPdfDoc.ts)
 *  - ถ้า engine ไม่ใช่ Anthropic Direct → ignore field นี้ ใช้ bitmap แทน
 */
export interface AnalyzePdfPage {
  blob: Blob;
  fileId: string;
  /** เลขหน้าใน file (1-indexed) */
  pageNum: number;
  /** ชื่อไฟล์ — debug only */
  fileName?: string;
}

export interface AnalyzeOptions {
  pageId: string;
  bitmap: HTMLCanvasElement;
  engine: AIEngine;
  mode: AIMode;
  hd?: boolean;
  /**
   * ถ้าหน้าต้นทางมาจาก PDF + engine = Anthropic Direct → ส่ง PDF page ตรง
   * (document type + cache_control ephemeral) แทน image
   */
  pdfPage?: AnalyzePdfPage;
  /** ภาพอ้างอิง (รายการวัสดุ/สัญลักษณ์/รายละเอียดทั่วไป) — สูงสุด 4 หน้า */
  referenceImages?: AIReferenceImage[];
  /**
   * Override prompt ที่ส่งใน user message — ถ้า user แก้ prompt textarea
   * (default: getUserPromptForDiscipline(discipline))
   */
  customUserPrompt?: string;
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
// OpenAI-compat message types
// ═══════════════════════════════════════════════════════════════════════

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  /**
   * Anthropic-only content block: PDF document (extracted single page).
   *  - inline base64 (≤ 20MB) หรือ file_id (Files API > 20MB)
   *  - cacheEphemeral = true → ใส่ cache_control:{type:'ephemeral'} ตอนส่ง
   *    (re-use cache 5 นาที — ลด token cost ของ chat follow-up)
   * ห้ามส่ง part ชนิดนี้ไป engine อื่นที่ไม่ใช่ Anthropic Direct
   */
  | {
      type: 'document';
      source: PdfDocSource;
      /** ใส่ cache_control:ephemeral ไหม (default true สำหรับ PDF page) */
      cacheEphemeral?: boolean;
    };

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
  const config = getEngineConfig(opts.engine);

  let out = await callAI(opts.messages, opts.engine, opts.hd, {
    outputTokens: config.maxOutputTokens,
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
    outputTokens: config.retryMaxOutputTokens,
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

  // ─── target: PDF document (Anthropic Direct + PDF) หรือ image (ทุกกรณีอื่น) ──
  // A3 fallback: ถ้า PDF path ล้มเหลว (extract/upload error) → fallback ใช้ image
  const useDocument =
    Boolean(config.isAnthropicDirect) && Boolean(opts.pdfPage);
  let targetImageDataUrl = '';
  let targetDocument: PdfDocSource | null = null;
  if (useDocument && opts.pdfPage) {
    try {
      targetDocument = await getPdfPageSource({
        blob: opts.pdfPage.blob,
        fileId: opts.pdfPage.fileId,
        pageNum: opts.pdfPage.pageNum,
        apiKey: config.apiKey,
        fileName: opts.pdfPage.fileName,
      });
      console.info(
        `[ai] 📄 PDF page ${opts.pdfPage.pageNum} → ${targetDocument.kind} (${(targetDocument.bytes / 1024).toFixed(0)}KB)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[ai] ⚠️ PDF path ล้มเหลว — fallback ไปใช้ image: ${msg}`,
      );
      targetDocument = null;
      opts.onProgress?.(`⚠️ PDF ส่งไม่ได้ — fallback image: ${msg.slice(0, 80)}`);
    }
  }
  if (!targetDocument) {
    targetImageDataUrl = downsampleCanvasToDataUrl(
      opts.bitmap,
      maxDim,
      config.imageQuality,
    );
  }
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
    const detectTarget: ChatContentPart = targetDocument
      ? { type: 'document', source: targetDocument, cacheEphemeral: true }
      : { type: 'image_url', image_url: { url: targetImageDataUrl } };
    const detectMessages: ChatMessage[] = [
      { role: 'system', content: getSystemPromptForMode('auto') },
      {
        role: 'user',
        content: [
          detectTarget,
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
    targetDocument,
    opts.customUserPrompt,
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

  // truncation guard — คำตอบโดน max_tokens ตัด (Anthropic stop_reason='max_tokens' → finishReason='length')
  const truncated = out.out.finishReason === 'length';
  if (truncated) {
    console.warn('[ai] ⚠️ Response ถูกตัด (max_tokens) — อาจถอดไม่ครบ');
  }

  const elapsedMs = Date.now() - start;
  const costStr =
    out.out.costUsd != null ? ` | cost: $${out.out.costUsd.toFixed(4)}` : '';
  console.info(
    `[ai] ✅ วิเคราะห์เสร็จ — items: ${result.items.length} | tokens: ${fmtTokens(out.out.tokens?.prompt_tokens)}/${fmtTokens(out.out.tokens?.completion_tokens)} | ${(elapsedMs / 1000).toFixed(1)}s${costStr}`,
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
 *  targetDocument ≠ null → ใช้ PDF document แทน image (Anthropic Direct เท่านั้น)
 *  ภาพ reference ยังเป็น image เสมอ (ไม่ใช่ document) — references มาจากหลายไฟล์
 *  รวมไป crop เป็น JPEG เพื่อความ portable
 */
export function buildAnalyzeMessages(
  discipline: AIDiscipline,
  targetImageDataUrl: string,
  references: AIReferenceImage[],
  targetDocument?: PdfDocSource | null,
  customUserPrompt?: string,
): ChatMessage[] {
  const system = getSystemPromptForMode(discipline);
  const trimmed = customUserPrompt?.trim();
  const baseUserText =
    trimmed && trimmed.length > 0
      ? trimmed
      : getUserPromptForDiscipline(discipline);

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

  if (targetDocument) {
    userContent.push({
      type: 'document',
      source: targetDocument,
      cacheEphemeral: true,
    });
  } else {
    userContent.push({
      type: 'image_url',
      image_url: { url: targetImageDataUrl },
    });
  }

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
// callAI — รับ messages array แบบ OpenAI-compat
// ═══════════════════════════════════════════════════════════════════════

interface AICallResult {
  text: string;
  model: string;
  tokens?: { prompt_tokens?: number; completion_tokens?: number };
  finishReason?: string;
  /** ค่าใช้จ่ายต่อ request เป็น USD (ถ้ารู้) — ปัจจุบันรองรับ OpenRouter ผ่าน header x-openrouter-cost */
  costUsd?: number;
}

interface CallAIOptions {
  outputTokens?: number;
}

export async function callAI(
  messages: ChatMessage[],
  engine: AIEngine,
  hd: boolean,
  options: CallAIOptions = {},
): Promise<AICallResult> {
  const config = getEngineConfig(engine);
  if (config.apiKey.trim()) {
    return callAIDirect(messages, engine, hd, options);
  }

  // Edge Function path: ส่ง messages array ผ่าน body (fallback ถ้าไม่ได้ใส่ browser key)
  const client = getSupabase();
  if (!client) {
    throw new Error(
      `ยังไม่ได้ตั้ง API key ของ ${config.label} ใน .env.local และยังไม่มี Supabase Edge Function`,
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
      engine,
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
    meta: { model: string; tokens?: AICallResult['tokens'] };
  };
  return { text: ok.raw, model: ok.meta.model, tokens: ok.meta.tokens };
}

/** อ่าน cost จาก response header (รองรับหลายชื่อ — OpenRouter ใช้ x-openrouter-cost) */
function parseCostHeader(headers: Headers): number | undefined {
  const candidates = [
    'x-openrouter-cost',
    'openrouter-cost',
    'x-cost-usd',
    'x-stainless-cost',
  ];
  for (const name of candidates) {
    const raw = headers.get(name);
    if (raw == null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

const tokenFmt = new Intl.NumberFormat('en-US');
function fmtTokens(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '?';
  return tokenFmt.format(n);
}

/** Log การใช้ token + cost ของ AI call เพื่อ debug/ติดตามค่าใช้จ่าย */
function logUsage(opts: {
  engine: AIEngine;
  promptTokens?: number;
  completionTokens?: number;
  finishReason?: string;
  costUsd?: number;
}): void {
  const config = getEngineConfig(opts.engine);
  console.info(
    `[ai] ${config.icon} ${config.label} — input: ${fmtTokens(opts.promptTokens)} tokens, output: ${fmtTokens(opts.completionTokens)} tokens | finish_reason: ${opts.finishReason ?? '-'}`,
  );
  if (opts.costUsd != null) {
    console.info(`[ai] 💰 Cost: $${opts.costUsd.toFixed(4)}`);
  }
}

function extractAssistantText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const obj = payload as Record<string, unknown>;
  const choices = obj.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    const msg = first?.message as Record<string, unknown> | undefined;
    const content = msg?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const parts = content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (!part || typeof part !== 'object') return '';
          const p = part as Record<string, unknown>;
          const t = p.text;
          return typeof t === 'string' ? t : '';
        })
        .filter(Boolean);
      if (parts.length > 0) return parts.join('\n');
    }
  }
  const candidates = obj.candidates;
  if (Array.isArray(candidates) && candidates.length > 0) {
    const content = (candidates[0] as Record<string, unknown>).content as
      | Record<string, unknown>
      | undefined;
    const parts = content?.parts;
    if (Array.isArray(parts)) {
      const text = parts
        .map((part) => {
          if (!part || typeof part !== 'object') return '';
          const t = (part as Record<string, unknown>).text;
          return typeof t === 'string' ? t : '';
        })
        .filter(Boolean)
        .join('\n');
      if (text) return text;
    }
  }
  return '';
}

async function callAIDirect(
  messages: ChatMessage[],
  engine: AIEngine,
  hd: boolean,
  options: CallAIOptions = {},
): Promise<AICallResult> {
  const config = getEngineConfig(engine);
  const outputTokens = options.outputTokens ?? config.maxOutputTokens;

  // เก็บสถิติ
  const totalChars = estimatePromptChars(messages);
  console.info(
    `[ai] ${config.label} | HD: ${hd} | prompt total chars: ${totalChars} | max_tokens: ${outputTokens}`,
  );

  // ─── Anthropic Direct (Messages API) ────────────────────────────────
  if (config.isAnthropicDirect) {
    return callAnthropicDirect(messages, config, outputTokens);
  }

  // OpenRouter รองรับ `usage: { include: true }` → คืน cost ใน body (usage.cost)
  // ตรวจจาก endpoint เพื่อเปิดเฉพาะ request ที่ผ่าน OpenRouter
  const isOpenRouter = config.endpoint.includes('openrouter.ai');

  const ctrl = new AbortController();
  const timeoutId = window.setTimeout(() => ctrl.abort(), config.timeoutMs);

  try {
    const requestBody: Record<string, unknown> = {
      model: config.model,
      messages,
      max_tokens: outputTokens,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    };
    if (isOpenRouter) {
      requestBody.usage = { include: true };
    }

    const res = await fetch(config.endpoint, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(config.extraHeaders ?? {}),
      },
      body: JSON.stringify(requestBody),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`${config.label} error ${res.status}: ${txt.slice(0, 500)}`);
    }
    // อ่าน cost จาก header ก่อน (อาจถูก expose หรือไม่ก็ได้)
    const costFromHeader = parseCostHeader(res.headers);

    const json = (await res.json()) as Record<string, unknown>;
    const text = extractAssistantText(json);
    const finishReason =
      Array.isArray(json.choices) && json.choices.length > 0
        ? (((json.choices[0] as Record<string, unknown>)
            ?.finish_reason as string | undefined) ??
          undefined)
        : undefined;
    const usage = json.usage as
      | {
          prompt_tokens?: number;
          completion_tokens?: number;
          cost?: number;
        }
      | undefined;

    // OpenRouter ส่ง cost (USD) มาใน usage.cost เมื่อขอ `usage: { include: true }`
    // ใช้ body ก่อน fallback ไป header
    const costFromBody =
      typeof usage?.cost === 'number' && Number.isFinite(usage.cost)
        ? usage.cost
        : undefined;
    const costUsd = costFromBody ?? costFromHeader;

    logUsage({
      engine,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      finishReason,
      costUsd,
    });

    return {
      text,
      model: config.model,
      tokens: usage,
      finishReason,
      costUsd,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `⏱️ AI ใช้เวลาเกิน ${Math.round(config.timeoutMs / 60_000)} นาที — ลอง:\n• ปิด HD\n• ลดจำนวนหน้าอ้างอิง\n• เลือก mode เฉพาะแทน อัตโนมัติ`,
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Anthropic Direct (Messages API) — format ต่างจาก OpenAI:
//   - system prompt อยู่ใน field "system" (ไม่ใช่ message role)
//   - image: { type:'image', source:{ type:'base64', media_type, data } }
//   - response: content[0].text (ไม่ใช่ choices[0].message.content)
// ═══════════════════════════════════════════════════════════════════════

type AnthropicCacheControl = { type: 'ephemeral' };

type AnthropicContentPart =
  | { type: 'text'; text: string; cache_control?: AnthropicCacheControl }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: string; data: string };
      cache_control?: AnthropicCacheControl;
    }
  | {
      type: 'document';
      source:
        | { type: 'base64'; media_type: 'application/pdf'; data: string }
        | { type: 'file'; file_id: string };
      cache_control?: AnthropicCacheControl;
    };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: AnthropicContentPart[];
}

/** แยก media_type + base64 data ออกจาก data URL ("data:image/jpeg;base64,xxxx") */
function parseDataUrl(url: string): { mediaType: string; data: string } {
  const m = url.match(/^data:([^;]+);base64,(.*)$/s);
  if (m) return { mediaType: m[1]!, data: m[2]! };
  return { mediaType: 'image/jpeg', data: url };
}

/** แปลง messages (OpenAI-compat) → Anthropic Messages API format
 *
 *  คืน hasDocument = true ถ้ามี document block (≥1 อันใน user content)
 *  caller ใช้ flag นี้ตัดสินใจส่ง anthropic-beta header
 */
function toAnthropicFormat(messages: ChatMessage[]): {
  system: string;
  messages: AnthropicMessage[];
  hasDocument: boolean;
  hasFileId: boolean;
} {
  let system = '';
  let hasDocument = false;
  let hasFileId = false;
  const out: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      const txt = typeof m.content === 'string' ? m.content : '';
      system += (system ? '\n\n' : '') + txt;
      continue;
    }
    const content: AnthropicContentPart[] =
      typeof m.content === 'string'
        ? [{ type: 'text', text: m.content }]
        : m.content.map((part): AnthropicContentPart => {
            if (part.type === 'text') return { type: 'text', text: part.text };
            if (part.type === 'document') {
              hasDocument = true;
              const cacheControl: AnthropicCacheControl | undefined =
                part.cacheEphemeral === false ? undefined : { type: 'ephemeral' };
              if (part.source.kind === 'file_id') {
                hasFileId = true;
                return {
                  type: 'document',
                  source: { type: 'file', file_id: part.source.fileId },
                  ...(cacheControl ? { cache_control: cacheControl } : {}),
                };
              }
              return {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: part.source.data,
                },
                ...(cacheControl ? { cache_control: cacheControl } : {}),
              };
            }
            const { mediaType, data } = parseDataUrl(part.image_url.url);
            return {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data },
            };
          });
    out.push({ role: m.role, content });
  }
  return { system, messages: out, hasDocument, hasFileId };
}

/** ดึง text จาก Anthropic response — content[] เป็น array ของ block (เอาเฉพาะ type:text) */
function extractAnthropicText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const content = (payload as Record<string, unknown>).content;
  if (!Array.isArray(content)) return '';
  return content
    .map((p) => {
      if (!p || typeof p !== 'object') return '';
      const t = (p as Record<string, unknown>).text;
      return typeof t === 'string' ? t : '';
    })
    .filter(Boolean)
    .join('\n');
}

async function callAnthropicDirect(
  messages: ChatMessage[],
  config: AIEngineConfig,
  outputTokens: number,
): Promise<AICallResult> {
  const {
    system,
    messages: anthropicMessages,
    hasDocument,
    hasFileId,
  } = toAnthropicFormat(messages);

  // anthropic-beta: ต้องส่งเมื่อใช้ document (pdfs-2024-09-25) หรือ file_id (files-api-2025-04-14)
  const betaParts: string[] = [];
  if (hasDocument) betaParts.push('pdfs-2024-09-25');
  if (hasFileId) betaParts.push('files-api-2025-04-14');
  const betaHeader = betaParts.join(',');

  const ctrl = new AbortController();
  const timeoutId = window.setTimeout(() => ctrl.abort(), config.timeoutMs);
  try {
    const requestBody: Record<string, unknown> = {
      model: config.model,
      max_tokens: outputTokens,
      temperature: 0, // deterministic — ผลซ้ำได้ไม่สุ่มแต่ละรอบ
      messages: anthropicMessages,
    };
    if (system) requestBody.system = system;

    const headers: Record<string, string> = {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    };
    if (betaHeader) headers['anthropic-beta'] = betaHeader;

    const res = await fetch(config.endpoint, {
      method: 'POST',
      signal: ctrl.signal,
      headers,
      body: JSON.stringify(requestBody),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(
        `${config.label} error ${res.status}: ${txt.slice(0, 500)}`,
      );
    }
    const json = (await res.json()) as Record<string, unknown>;
    const text = extractAnthropicText(json);
    // Anthropic ใช้ stop_reason='max_tokens' → map เป็น 'length' ให้ตรงกับ logic truncation
    const stopReason =
      typeof json.stop_reason === 'string' ? json.stop_reason : undefined;
    const finishReason = stopReason === 'max_tokens' ? 'length' : stopReason;
    const usage = json.usage as
      | {
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        }
      | undefined;
    const tokens = usage
      ? {
          prompt_tokens: usage.input_tokens,
          completion_tokens: usage.output_tokens,
        }
      : undefined;

    // log cache utilization — ช่วยยืนยันว่า ephemeral cache ใช้งานจริง
    if (usage?.cache_read_input_tokens || usage?.cache_creation_input_tokens) {
      console.info(
        `[ai] 💾 cache — read: ${fmtTokens(usage.cache_read_input_tokens)} tokens, created: ${fmtTokens(usage.cache_creation_input_tokens)} tokens`,
      );
    }

    logUsage({
      engine: config.id,
      promptTokens: tokens?.prompt_tokens,
      completionTokens: tokens?.completion_tokens,
      finishReason,
    });

    return { text, model: config.model, tokens, finishReason };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `⏱️ AI ใช้เวลาเกิน ${Math.round(config.timeoutMs / 60_000)} นาที — ลอง:\n• ปิด HD\n• ลดจำนวนหน้าอ้างอิง\n• เลือก mode เฉพาะแทน อัตโนมัติ`,
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
        else if (c.type === 'document') n += 2000; // overhead ของ PDF (ไม่นับ base64)
        else n += 1000; // overhead ของรูป (ไม่นับ base64)
      }
    }
  }
  return n;
}

/** flatten messages → legacy Edge fn payload (1 image + 1 prompt)
 *
 *  หมายเหตุ: ถ้ามี document part — flatten ไม่รองรับ (Edge fn เก่าไม่รู้จัก PDF)
 *  caller ต้องการันตีว่า document part ใช้กับ Anthropic Direct เท่านั้น
 */
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
          } else if (c.type === 'document') {
            throw new Error(
              'Legacy Edge Function ไม่รองรับ PDF document — ใช้ Anthropic Direct เท่านั้น',
            );
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
