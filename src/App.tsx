// src/App.tsx — 4-zone layout (spec §4): top toolbar / left thumbs / center canvas / right tabs / bottom status
import { useEffect, useRef, useState } from 'react';
import { TopToolbar } from './ui/TopToolbar';
import { StatusBar } from './ui/StatusBar';
import { ScaleDialog } from './ui/ScaleDialog';
import { ThumbnailPanel } from './panels/ThumbnailPanel';
import { RightPanel } from './panels/RightPanel';
import { DrawingCanvas } from './canvas/DrawingCanvas';

export function App() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = canvasHostRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(100, Math.floor(r.width)), h: Math.max(100, Math.floor(r.height)) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      style={{
        height: '100vh',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        background: '#111',
        color: '#eee',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif',
      }}
    >
      <TopToolbar />
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', overflow: 'hidden' }}>
        <ThumbnailPanel />
        <div ref={canvasHostRef} style={{ position: 'relative', overflow: 'hidden' }}>
          <DrawingCanvas width={size.w} height={size.h} />
        </div>
        <RightPanel />
      </div>
      <StatusBar />
      <ScaleDialog />
    </div>
  );
}
