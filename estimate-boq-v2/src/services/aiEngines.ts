/**
 * AI engine configs — ทุก engine ยิงผ่าน Supabase Edge Function `analyze`
 *
 * ❗ ไม่มี browser-direct แล้ว — API key อยู่ฝั่ง edge secret เท่านั้น
 *   (ไม่อ้าง import.meta.env.VITE_*_API_KEY → ไม่รั่วเข้า bundle)
 *
 * แต่ละ engine map → { provider, model } ส่งเข้า edge ทุกครั้ง
 *   routing: claude → Anthropic API ตรง (provider:'anthropic')
 *            ที่เหลือ → OpenRouter (provider:'openrouter')
 *
 * 4 ปุ่ม (เรียงซ้าย→ขวา): Claude · 3.1 Pro · 3.5 Flash · Flash
 *   Claude  (claude)  → anthropic  / claude-opus-4-6           — deep audit (tested)
 *   3.1 Pro (pro31)   → openrouter / gemini-3.1-pro-preview    — frontier Pro (tested)
 *   3.5 Flash(flash35)→ openrouter / gemini-3.5-flash          — QA (tested)
 *   Flash   (flash30) → openrouter / gemini-3-flash-preview    — daily (default, tested)
 *
 * ⚠️ pin Claude = claude-opus-4-6 — 4.7/4.8 regress บน grid count (อย่าอัป)
 */

export type AIProvider = 'anthropic' | 'openrouter';

export type AIEngine =
  | 'claude'
  | 'pro31'
  | 'flash35'
  | 'flash30';

export interface AIEngineConfig {
  id: AIEngine;
  label: string;
  /** short label สำหรับ UI selector */
  shortLabel: string;
  icon: string;
  /** provider ฝั่ง edge — 'anthropic' = ยิงตรง · 'openrouter' = ผ่าน OpenRouter */
  provider: AIProvider;
  /** model string ส่งเข้า edge (override env บน edge) */
  model: string;
  /** บทบาทของ engine (deep audit / frontier Pro / QA / daily) */
  role: string;
  /** ทดสอบความแม่นแล้วหรือยัง — false → UI เตือน "ตรวจ count เอง" */
  tested: boolean;
  maxImageDim: number;
  maxImageDimHD: number;
  imageQuality: number;
  refImageDim: number;
  refImageQuality: number;
}

const COMMON_IMAGE = {
  maxImageDim: 3000,
  maxImageDimHD: 4000,
  imageQuality: 0.85,
  // ⬆️ ref ต้องคมพอจะอ่านตาราง schedule (S2-02/04) ไม่งั้น AI ตอบ "ไม่มี Detail"
  refImageDim: 2200,
  refImageQuality: 0.85,
} as const;

const ENGINE_CONFIGS: Record<AIEngine, AIEngineConfig> = {
  claude: {
    id: 'claude',
    label: 'Claude',
    shortLabel: 'Claude',
    icon: '🟠',
    provider: 'anthropic',
    // ⚠️ pin 4.6 — 4.7/4.8 regress บน grid count (นับฐานจากกริด)
    model: 'claude-opus-4-6',
    role: 'deep audit',
    tested: true,
    ...COMMON_IMAGE,
  },
  pro31: {
    id: 'pro31',
    label: '3.1 Pro',
    shortLabel: '3.1 Pro',
    icon: '💎',
    provider: 'openrouter',
    // frontier Pro — เกรดผ่านแล้ว (มัก note GS/PS ให้ด้วย)
    model: 'google/gemini-3.1-pro-preview',
    role: 'frontier Pro',
    tested: true,
    ...COMMON_IMAGE,
  },
  flash35: {
    id: 'flash35',
    label: '3.5 Flash',
    shortLabel: '3.5 Flash',
    icon: '🔷',
    provider: 'openrouter',
    // QA pass — ทวนผล/ตรวจซ้ำ
    model: 'google/gemini-3.5-flash',
    role: 'QA',
    tested: true,
    ...COMMON_IMAGE,
  },
  flash30: {
    id: 'flash30',
    label: 'Flash',
    shortLabel: 'Flash',
    icon: '⚡',
    provider: 'openrouter',
    // daily driver (default) — ถอดมิติ/เหล็กจาก schedule
    model: 'google/gemini-3-flash-preview',
    role: 'daily',
    tested: true,
    ...COMMON_IMAGE,
  },
};

export function getEngineConfig(engine: AIEngine): AIEngineConfig {
  return ENGINE_CONFIGS[engine];
}

/** ลำดับซ้าย→ขวา ใน UI: Claude · 3.1 Pro · 3.5 Flash · Flash */
const ENGINE_PRIORITY: AIEngine[] = [
  'claude',
  'pro31',
  'flash35',
  'flash30',
];

/**
 * ทุก engine "พร้อมเสมอ" — key อยู่ฝั่ง edge secret
 * ถ้า secret ฝั่ง edge ขาด → edge คืน error ชัดเจนตอนเรียก (ไม่ gate ที่ frontend)
 */
export function getAvailableEngines(): AIEngine[] {
  return [...ENGINE_PRIORITY];
}

export function getDefaultEngine(): AIEngine {
  return 'flash30';
}

export function getEngineShortLabel(engine: AIEngine): string {
  const config = getEngineConfig(engine);
  return `${config.icon} ${config.shortLabel}`;
}

/** ตรวจว่า string เป็น AIEngine valid หรือไม่ — ใช้ตอน load จาก localStorage */
export function isAIEngine(value: unknown): value is AIEngine {
  return (
    value === 'claude' ||
    value === 'pro31' ||
    value === 'flash35' ||
    value === 'flash30'
  );
}

/**
 * Migrate engine id เก่า → ใหม่
 *  - 'gemini-flash' / 'gemini' / 'gemini-3-flash'   → 'flash30' (daily, default)
 *  - 'gemini-pro' / 'gemini-2.5-pro'                → 'flash35' (QA)
 *  - 'perceptron' / 'anthropic-opus' / 'qwen'       → 'claude'
 *  - GPT ทุกตัว (gpt4o/gpt41/gpt54/gpt5mini/gpt41mini — ถอดออก) → 'claude'
 *  คืน null ถ้า value ไม่ใช่ id เก่าที่ต้อง migrate
 */
export function migrateLegacyEngineId(value: unknown): AIEngine | null {
  if (
    value === 'gemini-flash' ||
    value === 'gemini' ||
    value === 'gemini-3-flash'
  )
    return 'flash30';
  if (value === 'gemini-pro' || value === 'gemini-2.5-pro') return 'flash35';
  if (value === 'perceptron' || value === 'anthropic-opus' || value === 'qwen')
    return 'claude';
  if (value === 'gpt4o' || value === 'gpt41' || value === 'gpt54')
    return 'claude';
  if (value === 'gpt5mini' || value === 'gpt41mini') return 'claude';
  return null;
}
