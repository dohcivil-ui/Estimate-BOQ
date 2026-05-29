/**
 * Chat follow-up — ส่ง user message + conversation history ผ่าน edge `analyze`
 *
 * Architecture:
 *   - Turn 1: system + user(images + initial text) + assistant(JSON result)
 *   - Turn 2+: เพิ่ม user/assistant ลงไปเรื่อยๆ (text-only)
 *   - ภาพไม่ต้องส่งซ้ำในรอบหลัง — history (text) ถูก flatten เข้า prompt
 *
 * ผลลัพธ์:
 *   - ถ้า AI ตอบ JSON ที่ parse ได้ → AIChatMessage.parsedResult set
 *     → user กด "✅ ใช้ผลนี้" → applyChatResult ใน aiStore
 *   - ถ้าตอบ text → แสดงใน chat bubble
 */
import type {
  AIAnalysis,
  AIAnalysisResponse,
  AIChatMessage,
  AIConversation,
  AIReferenceImage,
} from '@/types/ai';
import { getSystemPromptForMode } from './aiPrompts';
import {
  callAI,
  cleanJsonResponse,
  downsampleCanvasToDataUrl,
  tryParseAIResponse,
  type ChatContentPart,
  type ChatMessage,
  type ProgressCallback,
} from './aiAnalyze';
import { getEngineConfig, type AIEngine } from './aiEngines';

const HISTORY_TURN_LIMIT = 10; // เก็บ user+assistant รวม 10 ข้อความล่าสุด
const FOLLOWUP_SUFFIX = `\n\nคำแนะนำ:
- ถ้าเป็นคำสั่งแก้ไข BOQ → ตอบเป็น JSON format เดิม (discipline/drawing_type/items/notes/unreadable) มี items[] ที่ถูกต้องตามคำสั่ง
- ถ้าเป็นคำถามที่ไม่ต้องแก้ผล → ตอบเป็น JSON: {"answer": "<คำตอบภาษาไทย>"}
- ตอบ JSON เท่านั้น ห้ามมี markdown หรือข้อความนอก JSON`;

export interface SendChatOptions {
  analysis: AIAnalysis;
  conversation: AIConversation;
  targetBitmap: HTMLCanvasElement | null;
  referenceImages?: AIReferenceImage[];
  userMessage: string;
  engine: AIEngine;
  hd?: boolean;
  /** progress callback (spinner ระหว่างรอ edge) */
  onProgress?: ProgressCallback;
}

export interface SendChatResult {
  assistantMessage: AIChatMessage;
  /** สำเนา AIAnalysisResponse จาก reply (ถ้า parse ได้และมี items) */
  newResult?: AIAnalysisResponse;
}

const uid = (): string => crypto.randomUUID();
const now = (): string => new Date().toISOString();

export async function sendChatMessage(opts: SendChatOptions): Promise<SendChatResult> {
  const { analysis, conversation, targetBitmap, userMessage } = opts;
  const config = getEngineConfig(opts.engine);
  const refs = opts.referenceImages ?? [];

  if (!userMessage.trim()) {
    throw new Error('โปรดพิมพ์ข้อความก่อน');
  }
  if (!analysis.result) {
    throw new Error('ยังไม่มีผลวิเคราะห์เริ่มต้น — กดวิเคราะห์ก่อน');
  }

  // ─── target: image ของหน้าที่กำลังวิเคราะห์ ───────────────────────────
  if (!targetBitmap) {
    throw new Error('ไม่มี bitmap ของหน้าที่กำลังวิเคราะห์ — เปิดหน้าใหม่อีกครั้ง');
  }
  const targetImageDataUrl = downsampleCanvasToDataUrl(
    targetBitmap,
    opts.hd ? config.maxImageDimHD : config.maxImageDim,
    config.imageQuality,
  );
  const turn1Target: ChatContentPart = {
    type: 'image_url',
    image_url: { url: targetImageDataUrl },
  };

  // ─── Build messages array ─────────────────────────────────────────────
  const messages: ChatMessage[] = [
    { role: 'system', content: getSystemPromptForMode(analysis.discipline) },
  ];

  // Turn 1: refs + target + summary ของ initial analysis
  const turn1User: ChatContentPart[] = [];
  if (refs.length > 0) {
    turn1User.push({
      type: 'text',
      text: `📋 หน้าอ้างอิง ${refs.length} หน้า:`,
    });
    for (const r of refs) {
      turn1User.push({
        type: 'text',
        text: `--- หน้า ${r.pageNum}: ${r.label} ---`,
      });
      turn1User.push({ type: 'image_url', image_url: { url: r.dataUrl } });
    }
    turn1User.push({ type: 'text', text: '📐 หน้าที่กำลังวิเคราะห์:' });
  }
  turn1User.push(turn1Target);
  turn1User.push({
    type: 'text',
    text: 'นี่คือแบบที่กำลังวิเคราะห์ + ผลวิเคราะห์ปัจจุบัน (JSON):',
  });

  messages.push({ role: 'user', content: turn1User });
  messages.push({
    role: 'assistant',
    content: JSON.stringify(analysis.result),
  });

  // ─── Trim history ─────────────────────────────────────────────────────
  const history = conversation.messages.slice(-HISTORY_TURN_LIMIT);
  for (const m of history) {
    messages.push({
      role: m.role,
      content: m.content,
    });
  }

  // ─── New user message ─────────────────────────────────────────────────
  const finalUserText = userMessage.trim() + FOLLOWUP_SUFFIX;
  messages.push({ role: 'user', content: finalUserText });

  console.info(
    `[ai-chat] sending — turns: ${history.length}, refs: ${refs.length}`,
  );
  const start = Date.now();
  const out = await callAI(messages, opts.engine, opts.hd ?? false, {
    onProgress: opts.onProgress,
  });
  console.info(
    `[ai-chat] reply — ${((Date.now() - start) / 1000).toFixed(1)}s, tokens ${out.tokens?.prompt_tokens ?? '?'}/${out.tokens?.completion_tokens ?? '?'}`,
  );

  // ทำความสะอาด JSON ก่อน parse — กัน code fence หรือ text นอก JSON จาก AI
  const cleaned = cleanJsonResponse(out.text);
  const parsed = tryParseAIResponse(cleaned);
  let newResult: AIAnalysisResponse | undefined;

  // ตรวจว่าเป็นผลวิเคราะห์ใหม่ (มี items) หรือคำตอบ (answer only)
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.items)) {
      newResult = {
        discipline: (obj.discipline as AIAnalysisResponse['discipline']) ?? analysis.discipline,
        drawing_type: (obj.drawing_type as string | undefined) ?? analysis.result.drawing_type,
        scale: (obj.scale as string | undefined) ?? analysis.result.scale,
        building_info:
          (obj.building_info as AIAnalysisResponse['building_info']) ??
          analysis.result.building_info,
        items: obj.items as AIAnalysisResponse['items'],
        notes: (obj.notes as string[] | undefined) ?? [],
        unreadable: (obj.unreadable as string[] | undefined) ?? [],
      };
    }
  }

  const assistantMessage: AIChatMessage = {
    id: uid(),
    role: 'assistant',
    content: out.text,
    parsedResult: newResult,
    createdAt: now(),
  };

  return { assistantMessage, newResult };
}

/** สร้าง user message สำหรับ append ไป store */
export function buildUserMessage(text: string): AIChatMessage {
  return {
    id: uid(),
    role: 'user',
    content: text,
    createdAt: now(),
  };
}
