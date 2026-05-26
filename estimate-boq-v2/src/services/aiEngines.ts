/**
 * AI engine configs — OpenAI-compatible chat/completions
 *
 * รองรับ 5 engine:
 *   - claude        → Claude Sonnet 4 ผ่าน OpenRouter
 *   - gpt4o         → OpenAI GPT-4o ผ่าน OpenRouter
 *   - gemini-pro    → Google Gemini 2.5 Pro (OpenAI-compatible)
 *   - gemini-flash  → Google Gemini 2.5 Flash (OpenAI-compatible)
 *   - qwen          → Alibaba Qwen 3.5 Flash (OpenAI-compatible, DashScope)
 *
 * Default priority: claude > gpt4o > gemini-pro > gemini-flash > qwen
 *
 * Key mapping:
 *   - VITE_OPENROUTER_API_KEY → claude + gpt4o
 *   - VITE_GEMINI_API_KEY     → gemini-pro + gemini-flash
 *   - VITE_QWEN_API_KEY_DEV   → qwen
 */

export type AIEngine =
  | 'claude'
  | 'gpt4o'
  | 'gemini-pro'
  | 'gemini-flash'
  | 'qwen';

export interface AIEngineConfig {
  id: AIEngine;
  label: string;
  /** short label สำหรับ UI selector (เช่น "Claude", "Pro", "Flash") */
  shortLabel: string;
  icon: string;
  endpoint: string;
  model: string;
  apiKey: string;
  /** header เพิ่มเติม (เช่น OpenRouter ต้องการ HTTP-Referer / X-Title) */
  extraHeaders?: Record<string, string>;
  maxOutputTokens: number;
  retryMaxOutputTokens: number;
  maxImageDim: number;
  maxImageDimHD: number;
  imageQuality: number;
  refImageDim: number;
  refImageQuality: number;
  timeoutMs: number;
  supportsSystemRole: boolean;
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_HEADERS: Record<string, string> = {
  'HTTP-Referer': 'https://estimate-boq.app',
  'X-Title': 'Estimate BOQ v2',
};

const GOOGLE_OPENAI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export function getEngineConfig(engine: AIEngine): AIEngineConfig {
  switch (engine) {
    case 'claude':
      return {
        id: 'claude',
        label: 'Claude Sonnet 4.6',
        shortLabel: 'Claude',
        icon: '🟠',
        endpoint: OPENROUTER_ENDPOINT,
        model: 'anthropic/claude-sonnet-4.6',
        apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
        extraHeaders: OPENROUTER_HEADERS,
        maxOutputTokens: 16_384,
        retryMaxOutputTokens: 32_768,
        maxImageDim: 2000,
        maxImageDimHD: 3000,
        imageQuality: 0.85,
        refImageDim: 1500,
        refImageQuality: 0.8,
        timeoutMs: 180_000,
        supportsSystemRole: true,
      };
    case 'gpt4o':
      return {
        id: 'gpt4o',
        label: 'GPT-4o',
        shortLabel: 'GPT-4o',
        icon: '🧠',
        endpoint: OPENROUTER_ENDPOINT,
        model: 'openai/gpt-4o',
        apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
        extraHeaders: OPENROUTER_HEADERS,
        maxOutputTokens: 16_384,
        retryMaxOutputTokens: 16_384,
        maxImageDim: 2000,
        maxImageDimHD: 3000,
        imageQuality: 0.85,
        refImageDim: 1500,
        refImageQuality: 0.8,
        timeoutMs: 120_000,
        supportsSystemRole: true,
      };
    case 'gemini-pro':
      return {
        id: 'gemini-pro',
        label: 'Gemini 2.5 Pro',
        shortLabel: 'Pro',
        icon: '💎',
        endpoint:
          import.meta.env.VITE_GEMINI_ENDPOINT || GOOGLE_OPENAI_ENDPOINT,
        model: 'gemini-2.5-pro',
        apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
        // Gemini 2.5 Pro รองรับสูงสุด 65,535 — ตอบยาว/ละเอียดได้มาก
        maxOutputTokens: 16_384,
        retryMaxOutputTokens: 32_768,
        maxImageDim: 2000,
        maxImageDimHD: 3000,
        imageQuality: 0.85,
        refImageDim: 1500,
        refImageQuality: 0.8,
        timeoutMs: 180_000,
        supportsSystemRole: true,
      };
    case 'gemini-flash':
      return {
        id: 'gemini-flash',
        label: 'Gemini 2.5 Flash',
        shortLabel: 'Flash',
        icon: '⚡',
        endpoint:
          import.meta.env.VITE_GEMINI_ENDPOINT || GOOGLE_OPENAI_ENDPOINT,
        model: 'gemini-2.5-flash',
        apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
        maxOutputTokens: 16_384,
        retryMaxOutputTokens: 32_768,
        maxImageDim: 2000,
        maxImageDimHD: 3000,
        imageQuality: 0.85,
        refImageDim: 1500,
        refImageQuality: 0.8,
        timeoutMs: 120_000,
        supportsSystemRole: true,
      };
    case 'qwen':
      return {
        id: 'qwen',
        label: 'Qwen 3.5 Flash',
        shortLabel: 'Qwen',
        icon: '🔮',
        endpoint:
          import.meta.env.VITE_QWEN_ENDPOINT_DEV ||
          'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
        model: import.meta.env.VITE_QWEN_MODEL_DEV || 'qwen3.5-flash',
        apiKey: import.meta.env.VITE_QWEN_API_KEY_DEV || '',
        maxOutputTokens: 8192,
        retryMaxOutputTokens: 8192,
        maxImageDim: 1500,
        maxImageDimHD: 2500,
        imageQuality: 0.85,
        refImageDim: 1000,
        refImageQuality: 0.7,
        timeoutMs: 120_000,
        supportsSystemRole: true,
      };
  }
}

/** ลำดับ default — claude > gpt4o > gemini-pro > gemini-flash > qwen */
const ENGINE_PRIORITY: AIEngine[] = [
  'claude',
  'gpt4o',
  'gemini-pro',
  'gemini-flash',
  'qwen',
];

function hasKey(engine: AIEngine): boolean {
  switch (engine) {
    case 'claude':
    case 'gpt4o':
      // ทั้งคู่ใช้ OpenRouter — key เดียวกันเปิด 2 engine
      return Boolean(import.meta.env.VITE_OPENROUTER_API_KEY);
    case 'gemini-pro':
    case 'gemini-flash':
      // ทั้งคู่ใช้ Google AI Studio — key เดียวกันเปิด 2 engine
      return Boolean(import.meta.env.VITE_GEMINI_API_KEY);
    case 'qwen':
      return Boolean(import.meta.env.VITE_QWEN_API_KEY_DEV);
  }
}

/** คืน engine ที่ตั้ง API key ไว้ ในลำดับ priority */
export function getAvailableEngines(): AIEngine[] {
  return ENGINE_PRIORITY.filter(hasKey);
}

export function getDefaultEngine(): AIEngine {
  const first = ENGINE_PRIORITY.find(hasKey);
  return first ?? 'gemini-flash';
}

export function getEngineShortLabel(engine: AIEngine): string {
  const config = getEngineConfig(engine);
  return `${config.icon} ${config.shortLabel}`;
}

/** ตรวจว่า string เป็น AIEngine valid หรือไม่ — ใช้ตอน load จาก localStorage */
export function isAIEngine(value: unknown): value is AIEngine {
  return (
    value === 'claude' ||
    value === 'gpt4o' ||
    value === 'gemini-pro' ||
    value === 'gemini-flash' ||
    value === 'qwen'
  );
}

/**
 * Migrate engine id เก่า → ใหม่
 *  - 'gemini' (เดิมเป็น Flash) → 'gemini-flash'
 *  คืน null ถ้า value ไม่ใช่ string ที่ต้อง migrate
 */
export function migrateLegacyEngineId(value: unknown): AIEngine | null {
  if (value === 'gemini') return 'gemini-flash';
  return null;
}
