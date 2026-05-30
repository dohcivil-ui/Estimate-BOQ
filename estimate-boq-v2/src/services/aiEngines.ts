/**
 * AI engine configs — ทุก engine ยิงผ่าน Supabase Edge Function `analyze`
 *
 * ❗ ไม่มี browser-direct แล้ว — API key อยู่ฝั่ง edge secret เท่านั้น
 *   (ไม่อ้าง import.meta.env.VITE_*_API_KEY → ไม่รั่วเข้า bundle)
 *
 * แต่ละ engine map → { provider, model } ส่งเข้า edge ทุกครั้ง
 *   (env บน edge เป็นแค่ fallback ถ้า body ไม่ส่ง model)
 *
 *   Claude          → anthropic  / claude-opus-4-6           (แม่นสุด — accuracy)
 *   Gemini 2.5 Pro  → openrouter / google/gemini-2.5-pro     (สำรองความแม่น)
 *   Gemini 2.5 Flash→ openrouter / google/gemini-2.5-flash   (เร็ว/ถูก)
 *   Perceptron Mk1  → openrouter / perceptron/perceptron-mk1 (คืน bounding box, ctx 33K)
 *
 * ถอดออกแล้ว (เทสต์นับไม่แม่น):
 *   GPT-5.4      → 10/12 subtract trap
 *   GPT-4.1 Mini → กุมิติ (อันตรายกับ BOQ)
 */

export type AIProvider = 'anthropic' | 'openrouter';

export type AIEngine =
  | 'claude'
  | 'gemini-pro'
  | 'gemini-flash'
  | 'perceptron';

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
    label: 'Claude Opus 4.6',
    shortLabel: 'Claude',
    icon: '🟠',
    provider: 'anthropic',
    // pin 4-6 — 4.7/4.8 regress บน grid count (subtract trap) ทดสอบแล้ว 2 รอบ/ตัว
    model: 'claude-opus-4-6',
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
  'gemini-flash': {
    id: 'gemini-flash',
    label: 'Gemini 2.5 Flash',
    shortLabel: 'Flash',
    icon: '⚡',
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    ...COMMON_IMAGE,
  },
  perceptron: {
    id: 'perceptron',
    label: 'Perceptron Mk1',
    shortLabel: 'Box',
    icon: '📦',
    provider: 'openrouter',
    // purpose-built OCR/counting/spatial — คืน bounding box ต่อ object
    // annotation_format:"box" ใส่ที่ edge (เป็น request param ไม่ใช่ config)
    // ⚠️ ctx 33K → prompt สั้น; ถูก+เร็ว ($0.0018/รอบ ~10s); ไม่ติด subtract trap
    model: 'perceptron/perceptron-mk1',
    ...COMMON_IMAGE,
  },
};

export function getEngineConfig(engine: AIEngine): AIEngineConfig {
  return ENGINE_CONFIGS[engine];
}

/** ลำดับ default — claude > gemini-pro > gemini-flash > perceptron */
const ENGINE_PRIORITY: AIEngine[] = [
  'claude',
  'gemini-pro',
  'gemini-flash',
  'perceptron',
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
    value === 'gemini-pro' ||
    value === 'gemini-flash' ||
    value === 'perceptron'
  );
}

/**
 * Migrate engine id เก่า → ใหม่
 *  - 'anthropic-opus' (รวมเข้า claude)             → 'claude'
 *  - 'qwen'           (เลิกใช้)                     → 'claude'
 *  - 'gemini'         (เดิมเป็น Flash)              → 'gemini-flash'
 *  - GPT ทุกตัว (gpt4o/gpt41/gpt54 — ถอดออก)       → 'claude'
 *  - GPT mini ทุกตัว (gpt5mini/gpt41mini — ถอดออก) → 'gemini-flash'
 *  คืน null ถ้า value ไม่ใช่ id เก่าที่ต้อง migrate
 */
export function migrateLegacyEngineId(value: unknown): AIEngine | null {
  if (value === 'anthropic-opus') return 'claude';
  if (value === 'qwen') return 'claude';
  if (value === 'gemini') return 'gemini-flash';
  if (value === 'gpt4o' || value === 'gpt41' || value === 'gpt54') return 'claude';
  if (value === 'gpt5mini' || value === 'gpt41mini') return 'gemini-flash';
  return null;
}
