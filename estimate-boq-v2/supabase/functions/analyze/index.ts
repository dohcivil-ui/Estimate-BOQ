// @ts-nocheck — Deno runtime, ไม่ใช้ TS project ของ frontend
// ───────────────────────────────────────────────────────────────────────
// Edge Function: analyze
// ───────────────────────────────────────────────────────────────────────
// รับภาพแบบ + prompt จาก frontend → ส่งไป AI provider (OpenRouter | Anthropic)
//   → parse JSON → log ลง ai_analyses → return ให้ frontend
//
// provider เลือกได้ต่อ request (body.provider) หรือ default จาก env (AI_PROVIDER)
// model เลือกได้ต่อ request (body.model / body.model_hd) override env
//   → frontend สลับ GPT-5.4 / Gemini 2.5 Pro / Claude ได้โดยไม่ต้อง redeploy
//   (Gemini/GPT ยิงผ่าน OpenRouter ด้วย model string — ไม่ต้องมี branch แยก)
//
// Secrets ที่ต้องตั้งใน Supabase:
//   # เลือก provider default (ไม่บังคับ — default = openrouter)
//   supabase secrets set AI_PROVIDER=openrouter
//   # OpenRouter
//   supabase secrets set OPENROUTER_API_KEY=sk-or-xxx
//   supabase secrets set OPENROUTER_MODEL=...          # model default (non-HD)
//   supabase secrets set OPENROUTER_MODEL_HD=...        # optional — รุ่นละเอียด
//   # Anthropic (ถ้าใช้ provider=anthropic)
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
//   supabase secrets set ANTHROPIC_MODEL=claude-...     # model default (non-HD)
//   supabase secrets set ANTHROPIC_MODEL_HD=claude-...  # optional
//   # output token cap (ไม่บังคับ — default 16000)
//   supabase secrets set MAX_OUTPUT_TOKENS=16000
// ───────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DEFAULT_PROVIDER = (Deno.env.get('AI_PROVIDER') ?? 'openrouter').toLowerCase();
const MAX_OUTPUT_TOKENS = (() => {
  const n = Number(Deno.env.get('MAX_OUTPUT_TOKENS') ?? '16000');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 16000;
})();

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

type Provider = 'openrouter' | 'anthropic';

interface AnalyzeRequest {
  pageId: string;
  /** image as data URL: "data:image/jpeg;base64,..." */
  imageDataUrl?: string;
  /** หลายภาพ (ถ้ามี) — ถ้าไม่ส่ง ใช้ imageDataUrl ใบเดียว */
  images?: string[];
  /** prompt — frontend ส่ง prompt ภาษาไทย (user turn) */
  prompt: string;
  /** system prompt (optional) — ถ้ามี Anthropic จะ cache (ephemeral) */
  system?: string;
  /** true = ใช้รุ่นที่ละเอียดกว่า (MODEL_HD) */
  hd?: boolean;
  /** เลือก provider ต่อ request — override AI_PROVIDER */
  provider?: string;
  /** override model (non-HD) */
  model?: string;
  /** override model (HD) */
  model_hd?: string;
  /** optional: link กับ project */
  projectId?: string;
}

/** ผลลัพธ์ที่ normalize แล้วจากทุก provider */
interface ProviderResult {
  text: string;
  /** normalize: 'length' = โดน max_tokens ตัด (frontend ใช้ตรวจ truncation) */
  finishReason?: string;
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST')
    return jsonResponse({ error: 'method not allowed' }, 405);

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

  const images = body.images?.length
    ? body.images
    : body.imageDataUrl
      ? [body.imageDataUrl]
      : [];

  if (!body.pageId || images.length === 0 || !body.prompt) {
    return jsonResponse(
      { error: 'missing fields (pageId, imageDataUrl/images, prompt)' },
      400,
    );
  }

  // ─── เลือก provider + model + ตรวจ key ───────────────────────────────
  const provider = (body.provider ?? DEFAULT_PROVIDER).toLowerCase();
  if (provider !== 'openrouter' && provider !== 'anthropic') {
    return jsonResponse(
      { error: `provider ไม่รู้จัก: "${provider}" (รองรับ: openrouter, anthropic)` },
      400,
    );
  }

  const apiKey = Deno.env.get(
    provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENROUTER_API_KEY',
  );
  if (!apiKey) {
    const keyName =
      provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENROUTER_API_KEY';
    return jsonResponse(
      {
        error: `${keyName} ยังไม่ได้ตั้งเป็น secret — รัน: supabase secrets set ${keyName}=...`,
      },
      500,
    );
  }

  const model = resolveModel(provider as Provider, !!body.hd, body);
  if (!model) {
    const envBase = provider === 'anthropic' ? 'ANTHROPIC_MODEL' : 'OPENROUTER_MODEL';
    return jsonResponse(
      {
        error: `ไม่ได้กำหนด model: ส่ง body.model หรือ set env ${envBase} (/${envBase}_HD)`,
      },
      400,
    );
  }

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

  // ─── เรียก provider ──────────────────────────────────────────────────
  let result: ProviderResult;
  try {
    result =
      provider === 'anthropic'
        ? await callAnthropic({ apiKey, model, images, body })
        : await callOpenRouter({ apiKey, model, images, body });
  } catch (err) {
    const e = err as ProviderError;
    const msg = e?.message ?? String(err);
    await updateAnalysisStatus(admin, analysisId, 'error', msg.slice(0, 500));
    return jsonResponse(
      { error: msg, detail: e?.detail?.slice(0, 1000) },
      e?.status ?? 502,
    );
  }

  const text = result.text;
  if (!text) {
    await updateAnalysisStatus(admin, analysisId, 'error', 'empty response');
    return jsonResponse({ error: `empty response from ${provider}` }, 502);
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
      { error: 'AI ตอบไม่ใช่ JSON ที่ถูกต้อง', raw: text },
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
      tokens_in: result.usage.prompt_tokens ?? null,
      tokens_out: result.usage.completion_tokens ?? null,
    })
    .eq('id', analysisId ?? '00000000-0000-0000-0000-000000000000');

  return jsonResponse({
    result: parsed,
    raw: text,
    meta: {
      provider,
      model,
      elapsedMs,
      tokens: result.usage,
      finishReason: result.finishReason,
      analysisId,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════
// model resolution — body override env (hd → MODEL_HD, fallback non-HD)
// ═══════════════════════════════════════════════════════════════════════
function resolveModel(
  provider: Provider,
  hd: boolean,
  body: AnalyzeRequest,
): string | null {
  const isAnthropic = provider === 'anthropic';
  const envModel = Deno.env.get(isAnthropic ? 'ANTHROPIC_MODEL' : 'OPENROUTER_MODEL');
  const envModelHd = Deno.env.get(
    isAnthropic ? 'ANTHROPIC_MODEL_HD' : 'OPENROUTER_MODEL_HD',
  );
  if (hd) {
    // HD: body.model_hd → env _HD → fallback ตัว non-HD (body.model → env)
    return body.model_hd || envModelHd || body.model || envModel || null;
  }
  return body.model || envModel || null;
}

// ═══════════════════════════════════════════════════════════════════════
// OpenRouter (OpenAI-compatible) — รองรับ Claude / GPT / Gemini ผ่าน model string
// ═══════════════════════════════════════════════════════════════════════
async function callOpenRouter(args: {
  apiKey: string;
  model: string;
  images: string[];
  body: AnalyzeRequest;
}): Promise<ProviderResult> {
  const { apiKey, model, images, body } = args;

  const userContent = [
    ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
    { type: 'text', text: body.prompt },
  ];
  const messages = body.system
    ? [
        { role: 'system', content: body.system },
        { role: 'user', content: userContent },
      ]
    : [{ role: 'user', content: userContent }];

  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://estimate-boq.app',
      'X-Title': 'estimate-boq',
    },
    body: JSON.stringify({ model, messages, max_tokens: MAX_OUTPUT_TOKENS }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw providerError(`OpenRouter API ${res.status}`, 502, detail);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content ?? '';
  const finishReason = json.choices?.[0]?.finish_reason ?? undefined;
  const u = json.usage ?? {};
  return {
    text,
    finishReason,
    usage: {
      prompt_tokens: u.prompt_tokens,
      completion_tokens: u.completion_tokens,
      total_tokens: u.total_tokens,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Anthropic Messages API — system cached (ephemeral), image เป็น base64 source
// ═══════════════════════════════════════════════════════════════════════
async function callAnthropic(args: {
  apiKey: string;
  model: string;
  images: string[];
  body: AnalyzeRequest;
}): Promise<ProviderResult> {
  const { apiKey, model, images, body } = args;

  const imageBlocks = images.map((url) => {
    const parsed = parseDataUrl(url);
    if (!parsed) throw providerError('รูปไม่ใช่ data URL base64 ที่ถูกต้อง', 400);
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: parsed.media_type,
        data: parsed.data,
      },
    };
  });

  const payload: Record<string, unknown> = {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: 'user',
        content: [...imageBlocks, { type: 'text', text: body.prompt }],
      },
    ],
  };
  if (body.system) {
    payload.system = [
      {
        type: 'text',
        text: body.system,
        cache_control: { type: 'ephemeral' },
      },
    ];
  }

  const res = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw providerError(`Anthropic API ${res.status}`, 502, detail);
  }

  const json = await res.json();
  const text = (json.content ?? [])
    .filter((b: { type?: string }) => b.type === 'text')
    .map((b: { text?: string }) => b.text ?? '')
    .join('');
  // Anthropic stop_reason 'max_tokens' → normalize เป็น 'length' (เหมือน OpenAI)
  const finishReason =
    json.stop_reason === 'max_tokens' ? 'length' : (json.stop_reason ?? undefined);
  const u = json.usage ?? {};
  return {
    text,
    finishReason,
    usage: {
      prompt_tokens: u.input_tokens,
      completion_tokens: u.output_tokens,
      total_tokens:
        u.input_tokens != null && u.output_tokens != null
          ? u.input_tokens + u.output_tokens
          : undefined,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// helpers
// ═══════════════════════════════════════════════════════════════════════
interface ProviderError extends Error {
  status?: number;
  detail?: string;
}
function providerError(message: string, status: number, detail?: string): ProviderError {
  const e = new Error(message) as ProviderError;
  e.status = status;
  e.detail = detail;
  return e;
}

/** "data:image/png;base64,xxxx" → { media_type, data } */
function parseDataUrl(
  dataUrl: string,
): { media_type: string; data: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) return null;
  return { media_type: m[1]!, data: m[2]! };
}

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
