import { AuthGate } from '@/components/AuthGate';
import { TopBar } from '@/components/TopBar';
import { Toolbar } from '@/components/Toolbar';
import { ThumbnailPanel } from '@/components/ThumbnailPanel';
import { CanvasArea } from '@/components/CanvasArea';
import { SidePanel } from '@/components/SidePanel';
import { StatusBar } from '@/components/StatusBar';

export function App() {
  return (
    <AuthGate>
      <Workspace />
    </AuthGate>
  );
}

function Workspace() {
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
