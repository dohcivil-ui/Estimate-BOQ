import {
  createClient,
  type SupabaseClient,
  type Session,
} from '@supabase/supabase-js';
import type { Profile } from '@/types/user';

/**
 * Supabase client (frontend) — ใช้ public anon key เท่านั้น
 *
 * ห้าม import service-role key ฝั่ง browser
 * Edge Function รับ payload จาก client → เรียก Claude API ด้วย ANTHROPIC_API_KEY
 * ที่เก็บเป็น Supabase secret (ไม่หลุดมา frontend)
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return value.includes('YOUR-PROJECT') || value.includes('YOUR-PUBLIC');
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url) && !isPlaceholder(url) && Boolean(anonKey) && !isPlaceholder(anonKey);
}

/**
 * คืน Supabase client ถ้าตั้ง env ครบ; คืน null ถ้ายังไม่ได้ตั้ง
 * Caller ต้องเช็ค null ก่อนใช้
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!_client) {
    _client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return _client;
}

/** Throwing variant — ใช้เมื่อแน่ใจว่า configured แล้ว */
export function requireSupabase(): SupabaseClient {
  const client = getSupabase();
  if (!client) {
    throw new Error(
      'Supabase ยังไม่ได้ตั้งค่า — ตรวจ .env.local และดู docs/SUPABASE_SETUP.md',
    );
  }
  return client;
}

// ═══════════════════════════════════════════════════════════════════════
// Auth helpers
// ═══════════════════════════════════════════════════════════════════════

/** เริ่ม Google OAuth flow → redirect ออกจากหน้านี้ */
export async function signInWithGoogle(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  // ใน dev-bypass mode ไม่มี Supabase session — reload เพื่อกลับไปหน้า login (ถ้าปิด bypass)
  if (import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
    window.location.reload();
    return;
  }
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

/** ดึง profile (พร้อม role) ของ user ปัจจุบัน */
export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[supabase] fetchMyProfile error:', error);
    throw error;
  }
  return data as Profile | null;
}

export type { Session };
