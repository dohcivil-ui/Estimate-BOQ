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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
