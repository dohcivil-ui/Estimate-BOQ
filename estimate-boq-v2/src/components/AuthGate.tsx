import { useEffect, type ReactNode } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isAuthBypassed, useAuthStatus, useAuthStore } from '@/stores/authStore';
import { LoginPage } from './LoginPage';

interface Props {
  children: ReactNode;
}

/**
 * Wrapper ที่ตัดสินใจว่าจะให้เข้าใช้งานหรือเปล่า:
 *   - Supabase ไม่ได้ตั้ง           → หน้าแนะนำให้ตั้ง .env.local
 *   - กำลังเช็ค session             → spinner
 *   - ยังไม่ได้ login                → LoginPage
 *   - login แล้ว                    → children
 */
export function AuthGate({ children }: Props) {
  const status = useAuthStatus();
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    return init();
  }, [init]);

  if (!isAuthBypassed() && !isSupabaseConfigured()) {
    return <NotConfiguredScreen />;
  }

  if (status === 'unknown') {
    return <LoadingScreen />;
  }

  if (status === 'unauthenticated') {
    return <LoginPage />;
  }

  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg-base">
      <div className="flex flex-col items-center gap-3 text-ink-secondary">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-bg-border border-t-accent"
          aria-hidden="true"
        />
        <p className="text-sm">กำลังตรวจสอบสถานะ…</p>
      </div>
    </div>
  );
}

function NotConfiguredScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg-base p-6">
      <div className="w-full max-w-lg rounded-lg border border-warning/30 bg-bg-panel p-8 shadow-2xl">
        <h1 className="mb-2 text-xl font-bold text-warning">
          ⚠️ ยังไม่ได้ตั้งค่า Supabase
        </h1>
        <p className="mb-4 text-sm text-ink-secondary">
          แอปต้องเชื่อมต่อ Supabase เพื่อทำ Auth + DB
          ตอนนี้ <code className="rounded bg-bg-raised px-1.5 py-0.5">.env.local</code> ยังว่างหรือใส่ค่า placeholder อยู่
        </p>

        <ol className="space-y-2 text-sm text-ink-primary">
          <li className="flex gap-2">
            <span className="text-accent">1.</span>
            <span>
              คัดลอกไฟล์ <code className="rounded bg-bg-raised px-1.5 py-0.5">.env.example</code>{' '}
              เป็น <code className="rounded bg-bg-raised px-1.5 py-0.5">.env.local</code>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent">2.</span>
            <span>
              เติมค่า <code className="text-xs">VITE_SUPABASE_URL</code> และ{' '}
              <code className="text-xs">VITE_SUPABASE_ANON_KEY</code>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent">3.</span>
            <span>รัน migration init.sql ตามคู่มือ</span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent">4.</span>
            <span>ตั้ง Google OAuth provider</span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent">5.</span>
            <span>
              restart <code className="text-xs">npm run dev</code>
            </span>
          </li>
        </ol>

        <div className="mt-5 rounded border border-bg-border bg-bg-raised p-3 text-xs text-ink-secondary">
          📖 คู่มือเต็มอยู่ที่:{' '}
          <code>docs/SUPABASE_SETUP.md</code>
        </div>
      </div>
    </div>
  );
}
