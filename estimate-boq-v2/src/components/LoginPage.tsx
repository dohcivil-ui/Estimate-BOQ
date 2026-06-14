import { useState } from 'react';
import { signInWithGoogle } from '@/lib/supabase';
import { useAuthError } from '@/stores/authStore';

export function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const initError = useAuthError();

  const handleGoogle = async () => {
    setBusy(true);
    setLocalErr(null);
    try {
      await signInWithGoogle();
      // จะ redirect ออกจากหน้านี้ไป Google — ไม่ต้องทำต่อ
    } catch (err) {
      setBusy(false);
      setLocalErr(
        err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ — ลองอีกครั้ง',
      );
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg-base p-6">
      <a
        href="/"
        style={{
          position: 'fixed', top: 16, left: 16, zIndex: 50,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', fontSize: 14, fontWeight: 500,
          color: '#374151', background: 'rgba(255,255,255,0.95)',
          border: '1px solid #e5e7eb', borderRadius: 8,
          textDecoration: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <span aria-hidden>←</span> กลับหน้าหลัก
      </a>
      <div className="w-full max-w-md rounded-lg border border-bg-border bg-bg-panel p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="mb-1 text-2xl font-bold text-ink-primary">
            Estimate-BOQ <span className="text-accent">v2</span>
          </h1>
          <p className="text-sm text-ink-secondary">
            ประมาณราคาก่อสร้างด้วย AI — สำหรับวิศวกรโยธาไทย
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            อ้างอิงค่าแรง ว.809 (14 พ.ย. 2568) กรมบัญชีกลาง
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-md border border-bg-border bg-white px-4 py-2.5 text-sm font-medium text-ink-inverse transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleLogo className="h-5 w-5" />
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบด้วย Google'}
        </button>

        {(localErr || initError) && (
          <div className="mt-4 rounded border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            {localErr || initError}
          </div>
        )}

        <div className="mt-6 border-t border-bg-border pt-4 text-center text-xs text-ink-muted">
          <p>
            การเข้าใช้งานครั้งแรกจะสร้างบัญชีอัตโนมัติ (role:&nbsp;
            <span className="text-ink-secondary">user</span>)
          </p>
          <p className="mt-1">
            ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เพิ่มเติม
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.05-3.72 1.05-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.85 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.44 1.18 4.94l3.67-2.84z"
        fill="#FBBC04"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}
