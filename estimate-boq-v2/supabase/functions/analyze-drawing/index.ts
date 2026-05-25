// @ts-nocheck — Deno runtime, ไม่ใช้ TS project ของ frontend
// ───────────────────────────────────────────────────────────────────────
// Edge Function: analyze-drawing
// ───────────────────────────────────────────────────────────────────────
// รับภาพแบบ + prompt จาก frontend → ส่งไป Qwen (DashScope OpenAI-compat)
//   → parse JSON → log ลง ai_analyses → return ให้ frontend
//
// Secrets ที่ต้องตั้งใน Supabase:
//   supabase secrets set QWEN_API_KEY=sk-xxx
//   supabase secrets set QWEN_MODEL=qwen3.5-flash       # optional override
//   supabase secrets set QWEN_MODEL_HD=qwen-vl-max      # optional, default = same as QWEN_MODEL
//   supabase secrets set QWEN_ENDPOINT=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
// ───────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts';

const QWEN_ENDPOINT =
  Deno.env.get('QWEN_ENDPOINT') ??
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const QWEN_MODEL = Deno.env.get('QWEN_MODEL') ?? 'qwen3.5-flash';
const QWEN_MODEL_HD = Deno.env.get('QWEN_MODEL_HD') ?? QWEN_MODEL;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const QWEN_API_KEY = Deno.env.get('QWEN_API_KEY');

interface AnalyzeRequest {
  pageId: string;
  /** image as data URL: "data:image/jpeg;base64,..." */
  imageDataUrl: string;
  /** prompt — frontend ส่ง prompt ภาษาไทย */
  prompt: string;
  /** true = ใช้รุ่นที่ละเอียดกว่า (QWEN_MODEL_HD) */
  hd?: boolean;
  /** optional: link กับ project */
  projectId?: string;
}

interface QwenResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: string };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST')
    return jsonResponse({ error: 'method not allowed' }, 405);

  if (!QWEN_API_KEY) {
    return jsonResponse(
      {
        error:
          'QWEN_API_KEY ยังไม่ได้ตั้งเป็น secret ใน Supabase — รัน: supabase secrets set QWEN_API_KEY=sk-xxx',
      },
      500,
    );
  }

  // ─── Auth ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'unauthorized' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return jsonResponse({ error: 'invalid token' }, 401);
  }
  const userId = userData.user.id;

  // ─── parse body ──────────────────────────────────────────────────────
  let body: AnalyzeRequest;
  try {
    body = await req.json();
  } catch (err) {
    return jsonResponse({ error: `bad JSON: ${String(err)}` }, 400);
  }

  if (!body.pageId || !body.imageDataUrl || !body.prompt) {
    return jsonResponse(
      { error: 'missing fields (pageId, imageDataUrl, prompt)' },
      400,
    );
  }

  const model = body.hd ? QWEN_MODEL_HD : QWEN_MODEL;

  // ─── log "pending" row ───────────────────────────────────────────────
  let analysisId: string | null = null;
  if (body.projectId) {
    const ins = await admin
      .from('ai_analyses')
      .insert({
        project_id: body.projectId,
        page_id: body.pageId,
        model,
        prompt: body.prompt,
        status: 'pending',
        created_by: userId,
      })
      .select('id')
      .single();
    analysisId = ins.data?.id ?? null;
  }

  const startMs = Date.now();

  // ─── Call Qwen (OpenAI-compatible) ───────────────────────────────────
  let qwenJson: QwenResponse;
  try {
    const qwenRes = await fetch(`${QWEN_ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${QWEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: body.imageDataUrl },
              },
              { type: 'text', text: body.prompt },
            ],
          },
        ],
        // force JSON-ish response (Qwen รองรับบางรุ่น)
        response_format: { type: 'json_object' },
      }),
    });

    if (!qwenRes.ok) {
      const errText = await qwenRes.text();
      await updateAnalysisStatus(
        admin,
        analysisId,
        'error',
        `Qwen ${qwenRes.status}: ${errText.slice(0, 500)}`,
      );
      return jsonResponse(
        { error: `Qwen API ${qwenRes.status}`, detail: errText.slice(0, 1000) },
        502,
      );
    }
    qwenJson = await qwenRes.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAnalysisStatus(admin, analysisId, 'error', `fetch fail: ${msg}`);
    return jsonResponse({ error: `qwen fetch failed: ${msg}` }, 502);
  }

  const text = qwenJson.choices?.[0]?.message?.content ?? '';
  if (!text) {
    await updateAnalysisStatus(admin, analysisId, 'error', 'empty response');
    return jsonResponse({ error: 'empty response from Qwen', raw: qwenJson }, 502);
  }

  // ─── parse JSON (strip fence + retry-tolerant) ──────────────────────
  const parsed = tryParseJSON(text);
  if (!parsed) {
    await updateAnalysisStatus(
      admin,
      analysisId,
      'error',
      `JSON parse failed: ${text.slice(0, 300)}`,
    );
    return jsonResponse(
      {
        error: 'AI ตอบไม่ใช่ JSON ที่ถูกต้อง',
        raw: text,
      },
      500,
    );
  }

  const elapsedMs = Date.now() - startMs;

  // ─── log success ─────────────────────────────────────────────────────
  await admin
    .from('ai_analyses')
    .update({
      status: 'success',
      response_json: parsed,
      tokens_in: qwenJson.usage?.prompt_tokens ?? null,
      tokens_out: qwenJson.usage?.completion_tokens ?? null,
    })
    .eq('id', analysisId ?? '00000000-0000-0000-0000-000000000000');

  return jsonResponse({
    result: parsed,
    raw: text,
    meta: {
      model,
      elapsedMs,
      tokens: qwenJson.usage,
      analysisId,
    },
  });
});

function tryParseJSON(text: string): unknown | null {
  // strip code fence
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fence) s = fence[1]!;

  try {
    return JSON.parse(s);
  } catch {
    // try: find first { … last }
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

async function updateAnalysisStatus(
  admin: ReturnType<typeof createClient>,
  id: string | null,
  status: string,
  err?: string,
): Promise<void> {
  if (!id) return;
  await admin
    .from('ai_analyses')
    .update({ status, error_msg: err ?? null })
    .eq('id', id);
}
