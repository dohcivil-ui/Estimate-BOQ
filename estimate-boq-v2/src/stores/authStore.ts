import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { fetchMyProfile, getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AuthStatus, AuthUser, Profile } from '@/types/user';

/** ตรวจ flag dev-bypass — ใช้กับ local dev เท่านั้น */
export function isAuthBypassed(): boolean {
  return import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';
}

const FAKE_USER: AuthUser = {
  id: 'dev-bypass-uid',
  email: 'dev@local.test',
  profile: {
    id: 'dev-bypass-uid',
    email: 'dev@local.test',
    full_name: 'Dev Local',
    avatar_url: null,
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  session: Session | null;
  /** error ในขั้น init/refresh — ไม่ใช่ error ของการ login (อันนั้น throw ออก) */
  error: string | null;

  /** เรียกครั้งเดียวตอน App mount — fetch session + subscribe onAuthStateChange */
  init: () => () => void;

  setSession: (session: Session | null) => Promise<void>;
  refreshProfile: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'unknown',
  user: null,
  session: null,
  error: null,

  init: () => {
    if (isAuthBypassed()) {
      set({
        status: 'authenticated',
        user: FAKE_USER,
        session: null,
        error: null,
      });
      return () => {};
    }

    const client = getSupabase();
    if (!client) {
      set({ status: 'unauthenticated', user: null, session: null });
      return () => {};
    }

    void (async () => {
      try {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        await get().setSession(data.session);
      } catch (err) {
        console.error('[auth] init error:', err);
        set({
          status: 'unauthenticated',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      void get().setSession(session);
    });

    return () => sub.subscription.unsubscribe();
  },

  setSession: async (session) => {
    if (!session?.user) {
      set({ status: 'unauthenticated', user: null, session: null, error: null });
      return;
    }

    try {
      let profile: Profile | null = await fetchMyProfile(session.user.id);

      // กรณี trigger ใน DB ทำงานช้า/พลาด — retry 1 ครั้งหลัง 800ms
      if (!profile) {
        await new Promise((r) => setTimeout(r, 800));
        profile = await fetchMyProfile(session.user.id);
      }

      if (!profile) {
        set({
          status: 'unauthenticated',
          user: null,
          session: null,
          error:
            'หา profile ของบัญชีนี้ไม่เจอ — ตรวจว่ารัน migration init.sql แล้วหรือยัง (trigger on_auth_user_created)',
        });
        return;
      }

      set({
        status: 'authenticated',
        session,
        user: {
          id: session.user.id,
          email: session.user.email ?? profile.email,
          profile,
        },
        error: null,
      });
    } catch (err) {
      console.error('[auth] setSession error:', err);
      set({
        status: 'unauthenticated',
        user: null,
        session: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  refreshProfile: async () => {
    const session = get().session;
    if (!session?.user) return;
    const profile = await fetchMyProfile(session.user.id);
    if (profile) {
      set((s) =>
        s.user ? { user: { ...s.user, profile } } : s,
      );
    }
  },

  clear: () =>
    set({
      status: 'unauthenticated',
      user: null,
      session: null,
      error: null,
    }),
}));

// ─── selectors (เลือกใช้แทน useAuthStore() ตรงๆ เพื่อ minimize re-render) ──
export const useAuthStatus = () => useAuthStore((s) => s.status);
export const useCurrentUser = () => useAuthStore((s) => s.user);
export const useIsAdmin = () =>
  useAuthStore((s) => s.user?.profile.role === 'admin');
export const useAuthError = () => useAuthStore((s) => s.error);

/** สำหรับ component ที่อยู่นอก React tree (เช่น service module) */
export function getCurrentUser(): AuthUser | null {
  return useAuthStore.getState().user;
}

export function isConfigured(): boolean {
  return isSupabaseConfigured();
}
