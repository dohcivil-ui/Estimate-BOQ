import { useEffect, useRef } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { TopBar } from '@/components/TopBar';
import { Toolbar } from '@/components/Toolbar';
import { ThumbnailPanel } from '@/components/ThumbnailPanel';
import { CanvasArea } from '@/components/CanvasArea';
import { SidePanel } from '@/components/SidePanel';
import { StatusBar } from '@/components/StatusBar';
import { loadProject } from '@/services/projectSync';
import { getLastProjectId, clearLastProjectId } from '@/services/lastProject';
import { useCurrentProject } from '@/stores/currentProjectStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isAuthBypassed } from '@/stores/authStore';

export function App() {
  return (
    <AuthGate>
      <Workspace />
    </AuthGate>
  );
}

function Workspace() {
  // boot: auto-restore โปรเจกต์ล่าสุด (inc5/R1-C6) — รันใน AuthGate = หลัง auth ผ่านแล้ว
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return; // กัน StrictMode double-run (dev)
    bootedRef.current = true;
    // guard: dev-bypass / ไม่มี Supabase → ไม่มี session ให้โหลด
    if (!isSupabaseConfigured() || isAuthBypassed()) return;
    if (useCurrentProject.getState().projectId) return; // มีงานเปิดอยู่ → ไม่ทับ
    const id = getLastProjectId();
    if (!id) return; // ไม่เคยเซฟ → landing ปกติ
    void loadProject(id).catch(() => {
      clearLastProjectId(); // ถูกลบ/โหลดพลาด → ล้างคีย์ ไม่ค้าง error
    });
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg-base text-ink-primary">
      <TopBar />
      <Toolbar />

      <main className="flex min-h-0 flex-1">
        <aside className="w-56 shrink-0 border-r panel">
          <ThumbnailPanel />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <CanvasArea />
        </section>

        <aside className="w-96 shrink-0 border-l panel">
          <SidePanel />
        </aside>
      </main>

      <StatusBar />
    </div>
  );
}
