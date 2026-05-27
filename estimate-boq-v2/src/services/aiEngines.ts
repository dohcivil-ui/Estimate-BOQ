/**
 * AI engine configs — OpenAI-compatible chat/completions
 *
 * รองรับ 6 engine:
 *   - claude        → Claude Sonnet 4.6 ผ่าน OpenRouter
 *   - gpt54         → OpenAI GPT-5.4 ผ่าน OpenRouter (1M context)
 *   - gpt41mini     → OpenAI GPT-4.1 Mini ผ่าน OpenRouter (ตัวถูก/เร็ว)
 *   - gemini-pro    → Google Gemini 2.5 Pro (OpenAI-compatible)
 *   - gemini-flash  → Google Gemini 2.5 Flash (OpenAI-compatible)
 *   - qwen          → Alibaba Qwen 3.5 Flash (OpenAI-compatible, DashScope)
 *
 * Default priority: claude > gpt54 > gpt41mini > gemini-pro > gemini-flash > qwen
 *
 * Key mapping:
 *   - VITE_OPENROUTER_API_KEY → claude + gpt54 + gpt41mini
 *   - VITE_GEMINI_API_KEY     → gemini-pro + gemini-flash
 *   - VITE_QWEN_API_KEY_DEV   → qwen
 */

export type AIEngine =
  | 'claude'
  | 'anthropic-opus'
  | 'gpt54'
  | 'gpt41mini'
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
  /** true = เรียก Anthropic Messages API ตรง (ผ่าน Vite proxy) แทน OpenAI-compat */
  isAnthropicDirect?: boolean;
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
    case 'claude': {
      // ถ้ามี Anthropic key → เรียก Direct API (ผ่าน Vite proxy); ไม่งั้น fallback OpenRouter
      const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
      if (anthropicKey) {
        return {
          id: 'claude',
          label: 'Claude Sonnet 4 (Direct)',
          shortLabel: 'Claude',
          icon: '🟠',
          endpoint: '/anthropic-api/v1/messages',
          model: 'claude-sonnet-4-20250514',
          apiKey: anthropicKey,
          isAnthropicDirect: true,
          maxOutputTokens: 16_384,
          retryMaxOutputTokens: 16_384,
          maxImageDim: 3000,
          maxImageDimHD: 4000,
          imageQuality: 0.85,
          refImageDim: 1500,
          refImageQuality: 0.8,
          timeoutMs: 180_000,
          supportsSystemRole: true,
        };
      }
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
        maxImageDim: 3000,
        maxImageDimHD: 4000,
        imageQuality: 0.85,
        refImageDim: 1500,
        refImageQuality: 0.8,
        timeoutMs: 180_000,
        supportsSystemRole: true,
      };
    }
    case 'gpt54':
      return {
        id: 'gpt54',
        label: 'GPT-5.4',
        shortLabel: '5.4',
        icon: '🧠',
        endpoint: OPENROUTER_ENDPOINT,
        model: 'openai/gpt-5.4',
        apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
        extraHeaders: OPENROUTER_HEADERS,
        maxOutputTokens: 16_384,
        retryMaxOutputTokens: 16_384,
        maxImageDim: 3000,
        maxImageDimHD: 4000,
        imageQuality: 0.85,
        refImageDim: 1500,
        refImageQuality: 0.8,
        // GPT-5.4 รองรับ context ใหญ่ — อาจตอบช้ากว่า
        timeoutMs: 180_000,
        supportsSystemRole: true,
      };
    case 'gpt41mini':
      return {
        id: 'gpt41mini',
        label: 'GPT-4.1 Mini',
        shortLabel: 'Mini',
        icon: '🧠',
        endpoint: OPENROUTER_ENDPOINT,
        model: 'openai/gpt-4.1-mini',
        apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
        extraHeaders: OPENROUTER_HEADERS,
        maxOutputTokens: 16_384,
        retryMaxOutputTokens: 16_384,
        maxImageDim: 3000,
        maxImageDimHD: 4000,
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
        maxImageDim: 3000,
        maxImageDimHD: 4000,
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
        maxImageDim: 3000,
        maxImageDimHD: 4000,
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
    case 'anthropic-opus':
      // Opus Direct — endpoint/proxy/key เดียวกับ Sonnet Direct เปลี่ยนแค่ model
      return {
        id: 'anthropic-opus',
        label: 'Claude Opus 4.6 (Direct)',
        shortLabel: 'Opus',
        icon: '🟣',
        endpoint: '/anthropic-api/v1/messages',
        model: 'claude-opus-4-6',
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
        isAnthropicDirect: true,
        maxOutputTokens: 16_384,
        retryMaxOutputTokens: 16_384,
        maxImageDim: 3000,
        maxImageDimHD: 4000,
        imageQuality: 0.85,
        refImageDim: 1500,
        refImageQuality: 0.8,
        timeoutMs: 180_000,
        supportsSystemRole: true,
      };
  }
}

/** ลำดับ default — claude > opus > gpt54 > gpt41mini > gemini-pro > gemini-flash > qwen */
const ENGINE_PRIORITY: AIEngine[] = [
  'claude',
  'anthropic-opus',
  'gpt54',
  'gpt41mini',
  'gemini-pro',
  'gemini-flash',
  'qwen',
];

function hasKey(engine: AIEngine): boolean {
  switch (engine) {
    case 'claude':
      // claude: ใช้ได้ทั้ง Anthropic Direct หรือ OpenRouter
      return (
        Boolean(import.meta.env.VITE_ANTHROPIC_API_KEY) ||
        Boolean(import.meta.env.VITE_OPENROUTER_API_KEY)
      );
    case 'anthropic-opus':
      // opus: Anthropic Direct เท่านั้น
      return Boolean(import.meta.env.VITE_ANTHROPIC_API_KEY);
    case 'gpt54':
    case 'gpt41mini':
      // ทั้ง 2 ใช้ OpenRouter — key เดียวกันเปิด 2 engine
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
    value === 'anthropic-opus' ||
    value === 'gpt54' ||
    value === 'gpt41mini' ||
    value === 'gemini-pro' ||
    value === 'gemini-flash' ||
    value === 'qwen'
  );
}

/**
 * Migrate engine id เก่า → ใหม่
 *  - 'gemini'   (เดิมเป็น Flash)               → 'gemini-flash'
 *  - 'gpt4o'    (rename สู่ GPT-5.4)            → 'gpt54'
 *  - 'gpt41'    (rename สู่ GPT-5.4)            → 'gpt54'
 *  - 'gpt5mini' (เลิกใช้ — เปลี่ยนเป็น 4.1 Mini) → 'gpt41mini'
 *  คืน null ถ้า value ไม่ใช่ id เก่าที่ต้อง migrate
 */
export function migrateLegacyEngineId(value: unknown): AIEngine | null {
  if (value === 'gemini') return 'gemini-flash';
  if (value === 'gpt4o') return 'gpt54';
  if (value === 'gpt41') return 'gpt54';
  if (value === 'gpt5mini') return 'gpt41mini';
  return null;
}
