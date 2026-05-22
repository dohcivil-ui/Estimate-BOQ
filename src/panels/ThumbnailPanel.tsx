import { useDrawingStore } from '../stores/drawingStore';
import { useScaleStore } from '../stores/scaleStore';
import { useMeasurementStore } from '../stores/measurementStore';

export function ThumbnailPanel() {
  const pages = useDrawingStore((s) => s.pages);
  const activePageId = useDrawingStore((s) => s.activePageId);
  const setActivePage = useDrawingStore((s) => s.setActivePage);
  // subscribe ที่ map ทั้งก้อน — re-render เมื่อมี scale ใหม่
  const scalesByPageId = useScaleStore((s) => s.byPageId);
  // นับ measurement live จาก measurementStore (badge update เมื่อ add/delete)
  const measurementsByPageId = useMeasurementStore((s) => s.byPageId);

  return (
    <div
      style={{
        width: 196,
        background: '#171717',
        borderRight: '1px solid #2a2a2a',
        color: '#ddd',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '8px 10px', fontSize: 12, borderBottom: '1px solid #2a2a2a', color: '#aaa' }}>
        หน้าแบบ ({pages.length})
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pages.length === 0 && (
          <div style={{ fontSize: 12, color: '#666', padding: 8 }}>ยังไม่มีหน้าแบบ</div>
        )}
        {pages.map((p) => {
          const active = p.id === activePageId;
          const hasScale = !!scalesByPageId[p.id];
          const liveCount = measurementsByPageId[p.id]?.length ?? p.measurementCount;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePage(p.id)}
              style={{
                textAlign: 'left',
                background: active ? '#243d63' : '#1f1f1f',
                border: active ? '1px solid #5b9dff' : '1px solid #2a2a2a',
                borderRadius: 4,
                padding: 6,
                cursor: 'pointer',
                color: '#ddd',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {p.thumbnailDataUrl ? (
                <img
                  src={p.thumbnailDataUrl}
                  alt={`page ${p.pageNumber}`}
                  loading="lazy"
                  style={{ width: '100%', display: 'block', background: '#fff', borderRadius: 2 }}
                />
              ) : (
                <div style={{ height: 80, background: '#0e0e0e', borderRadius: 2 }} />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>หน้า {p.pageNumber}</span>
                <span>
                  <span
                    title={hasScale ? 'ตั้ง scale แล้ว' : 'ยังไม่ตั้ง scale'}
                    style={{ color: hasScale ? '#7dd87d' : '#e6b450' }}
                  >
                    {hasScale ? '✓ scale' : '⚠ scale'}
                  </span>
                  <span style={{ marginLeft: 6, color: '#999' }}>· {liveCount} ม.</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
