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
    // ตรวจ RLS status ตอน client ถูกสร้างครั้งแรก — log ไป console (dev เท่านั้น)
    void logRLSDiagnostic(_client);
  }
  return _client;
}

// ═══════════════════════════════════════════════════════════════════════
// Startup diagnostic — ตรวจ RLS status + Storage bucket
// ═══════════════════════════════════════════════════════════════════════

const REQUIRED_TABLES = [
  'profiles',
  'projects',
  'drawing_files',
  'drawing_pages',
  'shapes',
  'boq_items',
  'ai_analyses',
  'material_prices',
  'delete_requests',
] as const;

const DRAWINGS_BUCKET = 'drawings';
let _diagnosticRun = false;

async function logRLSDiagnostic(client: SupabaseClient): Promise<void> {
  if (_diagnosticRun) return;
  _diagnosticRun = true;
  if (!import.meta.env.DEV) return;

  try {
    // เช็คว่า required tables มีอยู่จริงหรือไม่ — ลอง select แบบ count=0
    const tableStatus: Record<string, 'ok' | 'missing' | 'rls-blocked'> = {};
    await Promise.all(
      REQUIRED_TABLES.map(async (t) => {
        const { error } = await client.from(t).select('*', {
          count: 'exact',
          head: true,
        });
        if (!error) {
          tableStatus[t] = 'ok';
        } else if (
          error.code === 'PGRST116' ||
          error.message?.includes('does not exist')
        ) {
          tableStatus[t] = 'missing';
        } else {
          tableStatus[t] = 'rls-blocked';
        }
      }),
    );

    const missing = REQUIRED_TABLES.filter((t) => tableStatus[t] === 'missing');
    const ok = REQUIRED_TABLES.filter((t) => tableStatus[t] === 'ok');
    const rls = REQUIRED_TABLES.filter(
      (t) => tableStatus[t] === 'rls-blocked',
    );

    console.info(
      `[supabase] tables ready: ${ok.length}/${REQUIRED_TABLES.length}` +
        (missing.length > 0 ? ` | missing: ${missing.join(', ')}` : '') +
        (rls.length > 0 ? ` | rls-blocked: ${rls.join(', ')}` : ''),
    );

    if (missing.length > 0) {
      console.warn(
        '[supabase] ⚠️ บาง table ขาด — รัน migration:\n' +
          '  1. supabase/migrations/20260525120000_init.sql\n' +
          '  2. supabase/migrations/20260525130000_drawing_files_and_storage.sql\n' +
          '  3. supabase/fix-rls-policies.sql (กัน RLS error)',
      );
    }

    // เช็ค Storage bucket
    const { data: buckets, error: bucketErr } =
      await client.storage.listBuckets();
    if (bucketErr) {
      console.warn('[supabase] ตรวจ Storage bucket ไม่ได้:', bucketErr.message);
    } else {
      const hasBucket = (buckets ?? []).some((b) => b.id === DRAWINGS_BUCKET);
      if (hasBucket) {
        console.info(`[supabase] Storage bucket "${DRAWINGS_BUCKET}" พร้อมใช้`);
      } else {
        console.warn(
          `[supabase] ⚠️ Storage bucket "${DRAWINGS_BUCKET}" ยังไม่มี — ` +
            'รัน supabase/fix-rls-policies.sql ใน SQL Editor',
        );
      }
    }
  } catch (err) {
    console.warn('[supabase] diagnostic failed:', err);
  }
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
      redirectTo: window.location.origin + import.meta.env.BASE_URL,
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
