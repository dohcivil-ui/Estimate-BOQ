import type { Tool } from '../types';
import { useToolStore } from '../stores/toolStore';
import { FileImportButton } from './FileImportButton';

const TOOLS: { id: Tool; label: string; enabled: boolean; phase: 1 | 2 | 3 }[] = [
  { id: 'select', label: 'Select', enabled: true, phase: 1 },
  { id: 'pan', label: 'Pan', enabled: true, phase: 1 },
  { id: 'scale', label: 'Scale', enabled: true, phase: 2 },
  { id: 'line', label: 'Line', enabled: false, phase: 3 },
  { id: 'polyline', label: 'Polyline', enabled: false, phase: 3 },
  { id: 'area', label: 'Area', enabled: false, phase: 3 },
  { id: 'rect', label: 'Rect', enabled: false, phase: 3 },
  { id: 'count', label: 'Count', enabled: false, phase: 3 },
];

export function TopToolbar() {
  const current = useToolStore((s) => s.current);
  const setTool = useToolStore((s) => s.setTool);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        borderBottom: '1px solid #333',
        background: '#1f1f1f',
        color: '#ddd',
        fontSize: 13,
      }}
    >
      <FileImportButton />
      <span style={{ width: 1, height: 22, background: '#333' }} />
      {TOOLS.map((t) => {
        const enabled = t.enabled;
        const active = current === t.id;
        return (
          <button
            key={t.id}
            type="button"
            disabled={!enabled}
            onClick={() => enabled && setTool(t.id)}
            title={enabled ? '' : `เปิดใช้งานใน Phase ${t.phase}`}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              border: active ? '1px solid #5b9dff' : '1px solid #444',
              background: active ? '#284a7a' : '#2a2a2a',
              color: enabled ? '#ddd' : '#666',
              cursor: enabled ? 'pointer' : 'not-allowed',
              borderRadius: 4,
            }}
          >
            {t.label}
          </button>
        );
      })}
      <span style={{ width: 1, height: 22, background: '#333' }} />
      <button type="button" disabled style={{ padding: '4px 10px', fontSize: 12, color: '#666' }}>
        Undo
      </button>
      <button type="button" disabled style={{ padding: '4px 10px', fontSize: 12, color: '#666' }}>
        Redo
      </button>
      <span style={{ flex: 1 }} />
      <button type="button" disabled style={{ padding: '4px 10px', fontSize: 12, color: '#666' }}>
        AI Review
      </button>
    </div>
  );
}
