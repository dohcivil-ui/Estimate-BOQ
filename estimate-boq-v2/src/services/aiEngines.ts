/**
 * AI engine configs — ทุก engine ยิงผ่าน Supabase Edge Function `analyze`
 *
 * ❗ ไม่มี browser-direct แล้ว — API key อยู่ฝั่ง edge secret เท่านั้น
 *   (ไม่อ้าง import.meta.env.VITE_*_API_KEY → ไม่รั่วเข้า bundle)
 *
 * แต่ละ engine map → { provider, model } ส่งเข้า edge ทุกครั้ง
 *   (env บน edge เป็นแค่ fallback ถ้า body ไม่ส่ง model)
 *
 *   Claude         → anthropic  / claude-opus-4-8
 *   GPT-5.4        → openrouter / openai/gpt-5.4
 *   Gemini 2.5 Pro → openrouter / google/gemini-2.5-pro
 *   GPT-4.1 Mini   → openrouter / openai/gpt-4.1-mini   (ตัวถูก/เร็ว)
 *   Gemini 2.5 Flash → openrouter / google/gemini-2.5-flash (ตัวถูก/เร็ว)
 */

export type AIProvider = 'anthropic' | 'openrouter';

export type AIEngine =
  | 'claude'
  | 'gpt54'
  | 'gpt41mini'
  | 'gemini-pro'
  | 'gemini-flash';

export interface AIEngineConfig {
  id: AIEngine;
  label: string;
  /** short label สำหรับ UI selector (เช่น "Claude", "Pro", "Flash") */
  shortLabel: string;
  icon: string;
  /** provider ฝั่ง edge */
  provider: AIProvider;
  /** model string ส่งเข้า edge (override env บน edge) */
  model: string;
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
  refImageDim: 1500,
  refImageQuality: 0.8,
} as const;

const ENGINE_CONFIGS: Record<AIEngine, AIEngineConfig> = {
  claude: {
    id: 'claude',
    label: 'Claude Opus 4.8',
    shortLabel: 'Claude',
    icon: '🟠',
    provider: 'anthropic',
    model: 'claude-opus-4-8',
    ...COMMON_IMAGE,
  },
  gpt54: {
    id: 'gpt54',
    label: 'GPT-5.4',
    shortLabel: '5.4',
    icon: '🧠',
    provider: 'openrouter',
    model: 'openai/gpt-5.4',
    ...COMMON_IMAGE,
  },
  'gemini-pro': {
    id: 'gemini-pro',
    label: 'Gemini 2.5 Pro',
    shortLabel: 'Pro',
    icon: '💎',
    provider: 'openrouter',
    model: 'google/gemini-2.5-pro',
    ...COMMON_IMAGE,
  },
  gpt41mini: {
    id: 'gpt41mini',
    label: 'GPT-4.1 Mini',
    shortLabel: 'Mini',
    icon: '🧠',
    provider: 'openrouter',
    model: 'openai/gpt-4.1-mini',
    ...COMMON_IMAGE,
  },
  'gemini-flash': {
    id: 'gemini-flash',
    label: 'Gemini 2.5 Flash',
    shortLabel: 'Flash',
    icon: '⚡',
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    ...COMMON_IMAGE,
  },
};

export function getEngineConfig(engine: AIEngine): AIEngineConfig {
  return ENGINE_CONFIGS[engine];
}

/** ลำดับ default — claude > gpt54 > gemini-pro > gpt41mini > gemini-flash */
const ENGINE_PRIORITY: AIEngine[] = [
  'claude',
  'gpt54',
  'gemini-pro',
  'gpt41mini',
  'gemini-flash',
];

/**
 * ทุก engine "พร้อมเสมอ" — key อยู่ฝั่ง edge secret
 * ถ้า secret ฝั่ง edge ขาด → edge คืน error ชัดเจนตอนเรียก (ไม่ gate ที่ frontend)
 */
export function getAvailableEngines(): AIEngine[] {
  return [...ENGINE_PRIORITY];
}

export function getDefaultEngine(): AIEngine {
  return 'claude';
}

export function getEngineShortLabel(engine: AIEngine): string {
  const config = getEngineConfig(engine);
  return `${config.icon} ${config.shortLabel}`;
}

/** ตรวจว่า string เป็น AIEngine valid หรือไม่ — ใช้ตอน load จาก localStorage */
export function isAIEngine(value: unknown): value is AIEngine {
  return (
    value === 'claude' ||
    value === 'gpt54' ||
    value === 'gpt41mini' ||
    value === 'gemini-pro' ||
    value === 'gemini-flash'
  );
}

/**
 * Migrate engine id เก่า → ใหม่
 *  - 'anthropic-opus' (รวมเข้า claude)          → 'claude'
 *  - 'qwen'           (เลิกใช้)                  → 'claude'
 *  - 'gemini'         (เดิมเป็น Flash)           → 'gemini-flash'
 *  - 'gpt4o'/'gpt41'  (rename สู่ GPT-5.4)       → 'gpt54'
 *  - 'gpt5mini'       (เปลี่ยนเป็น 4.1 Mini)     → 'gpt41mini'
 *  คืน null ถ้า value ไม่ใช่ id เก่าที่ต้อง migrate
 */
export function migrateLegacyEngineId(value: unknown): AIEngine | null {
  if (value === 'anthropic-opus') return 'claude';
  if (value === 'qwen') return 'claude';
  if (value === 'gemini') return 'gemini-flash';
  if (value === 'gpt4o') return 'gpt54';
  if (value === 'gpt41') return 'gpt54';
  if (value === 'gpt5mini') return 'gpt41mini';
  return null;
}
