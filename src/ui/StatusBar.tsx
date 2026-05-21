import { useCursorStore } from '../stores/cursorStore';
import { useDrawingStore } from '../stores/drawingStore';
import { useToolStore } from '../stores/toolStore';
import { useViewportStore } from '../stores/viewportStore';
import { useScaleStore } from '../stores/scaleStore';

export function StatusBar() {
  const cursor = useCursorStore((s) => s.pageCoord);
  const activePageId = useDrawingStore((s) => s.activePageId);
  const transform = useViewportStore((s) => (activePageId ? s.byPageId[activePageId] : undefined));
  const tool = useToolStore((s) => s.current);
  const profile = useScaleStore((s) => (activePageId ? s.byPageId[activePageId] ?? null : null));

  const zoomPct = transform ? Math.round(transform.zoom * 100) : 100;
  const cursorTxt = cursor
    ? `(${cursor.x.toFixed(0)}, ${cursor.y.toFixed(0)}) px`
    : '—';
  const scaleTxt = !activePageId
    ? '—'
    : profile
      ? `${profile.unitPerPixel.toFixed(6)} m/px (${(1 / profile.unitPerPixel).toFixed(1)} px/m)`
      : 'ยังไม่ตั้ง scale';

  return (
    <div
      style={{
        display: 'flex',
        gap: 18,
        padding: '4px 12px',
        background: '#1a1a1a',
        borderTop: '1px solid #2a2a2a',
        color: '#aaa',
        fontSize: 12,
      }}
    >
      <span>เครื่องมือ: {tool}</span>
      <span>cursor (page): {cursorTxt}</span>
      <span>zoom: {zoomPct}%</span>
      <span title={profile ? `calibrated ${new Date(profile.createdAt).toLocaleString()}` : ''}>
        scale: <b style={{ color: profile ? '#7dd87d' : '#e6b450' }}>{scaleTxt}</b>
      </span>
      <span style={{ flex: 1 }} />
      <span>snap: off</span>
    </div>
  );
}
