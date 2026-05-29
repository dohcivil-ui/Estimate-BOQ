/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** "true" = ข้าม login (dev only) — strip ออกในการ build production */
  readonly VITE_DEV_BYPASS_AUTH?: string;
  // ❗ ไม่มี VITE_*_API_KEY ของ AI provider แล้ว — key อยู่ฝั่ง Supabase Edge secret
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
