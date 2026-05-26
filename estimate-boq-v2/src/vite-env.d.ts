/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** "true" = ข้าม login (dev only) — strip ออกในการ build production */
  readonly VITE_DEV_BYPASS_AUTH?: string;
  /** DEV-only: เรียก Qwen ตรงจาก browser (INSECURE) */
  readonly VITE_QWEN_API_KEY_DEV?: string;
  readonly VITE_QWEN_ENDPOINT_DEV?: string;
  readonly VITE_QWEN_MODEL_DEV?: string;
  /** Google AI Studio — เปิด gemini-pro + gemini-flash */
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_GEMINI_ENDPOINT?: string;
  /** OpenRouter — เปิด claude + gpt41 + gpt41mini (1 key, 3 engine) */
  readonly VITE_OPENROUTER_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
