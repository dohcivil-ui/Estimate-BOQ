import { useState } from 'react';
import type { Tool } from '../types';
import { useToolStore } from '../stores/toolStore';
import { FileImportButton } from './FileImportButton';
import {
  useMeasurementStore,
  COUNT_CATEGORIES,
} from '../stores/measurementStore';
import {
  saveProject,
  loadProject,
  downloadProjectJSON,
} from '../services/persistence';
import { exportProjectExcel } from '../services/excelExport';

const TOOLS: { id: Tool; label: string; enabled: boolean; phase: 1 | 2 | 3 }[] = [
  { id: 'select', label: 'Select', enabled: true, phase: 1 },
  { id: 'pan', label: 'Pan', enabled: true, phase: 1 },
  { id: 'scale', label: 'Scale', enabled: true, phase: 2 },
  { id: 'line', label: 'Line', enabled: true, phase: 3 },
  { id: 'polyline', label: 'Polyline', enabled: true, phase: 3 },
  { id: 'area', label: 'Area', enabled: true, phase: 3 },
  { id: 'rect', label: 'Rect', enabled: true, phase: 3 },
  { id: 'count', label: 'Count', enabled: true, phase: 3 },
];

export function TopToolbar() {
  const current = useToolStore((s) => s.current);
  const setTool = useToolStore((s) => s.setTool);
  const past = useMeasurementStore((s) => s.past);
  const future = useMeasurementStore((s) => s.future);
  const undo = useMeasurementStore((s) => s.undo);
  const redo = useMeasurementStore((s) => s.redo);
  const countCategory = useMeasurementStore((s) => s.countCategory);
  const setCountCategory = useMeasurementStore((s) => s.setCountCategory);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  async function handleSave() {
    setSaveStatus('saving...');
    try {
      await saveProject();
      setSaveStatus(`บันทึก @ ${new Date().toLocaleTimeString()}`);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus('save error: ' + String(err));
    }
  }

  async function handleLoad() {
    try {
      const ok = await loadProject();
      setSaveStatus(ok ? 'โหลดแล้ว' : 'ไม่มี project ใน IndexedDB');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus('load error: ' + String(err));
    }
  }

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
      {current === 'count' && (
        <>
          <span style={{ color: '#888', fontSize: 11 }}>หมวด:</span>
          <select
            value={countCategory}
            onChange={(e) => setCountCategory(e.target.value)}
            style={{
              fontSize: 12,
              background: '#2a2a2a',
              color: '#ddd',
              border: '1px solid #444',
              borderRadius: 4,
              padding: '3px 6px',
            }}
          >
            {COUNT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </>
      )}
      <span style={{ width: 1, height: 22, background: '#333' }} />
      <button
        type="button"
        disabled={!canUndo}
        onClick={() => undo()}
        title="Undo (Ctrl/Cmd+Z)"
        style={{
          padding: '4px 10px',
          fontSize: 12,
          color: canUndo ? '#ddd' : '#666',
          background: '#2a2a2a',
          border: '1px solid #444',
          borderRadius: 4,
          cursor: canUndo ? 'pointer' : 'not-allowed',
        }}
      >
        Undo
      </button>
      <button
        type="button"
        disabled={!canRedo}
        onClick={() => redo()}
        title="Redo (Ctrl/Cmd+Shift+Z)"
        style={{
          padding: '4px 10px',
          fontSize: 12,
          color: canRedo ? '#ddd' : '#666',
          background: '#2a2a2a',
          border: '1px solid #444',
          borderRadius: 4,
          cursor: canRedo ? 'pointer' : 'not-allowed',
        }}
      >
        Redo
      </button>
      <span style={{ width: 1, height: 22, background: '#333' }} />
      <button
        type="button"
        onClick={handleSave}
        title="บันทึก project ลง IndexedDB (offline)"
        style={btnStyle()}
      >
        Save
      </button>
      <button
        type="button"
        onClick={handleLoad}
        title="โหลด project ล่าสุดจาก IndexedDB"
        style={btnStyle()}
      >
        Load
      </button>
      <button
        type="button"
        onClick={() => downloadProjectJSON()}
        title="Export project เป็น JSON (geometry+scale+BOQ)"
        style={btnStyle()}
      >
        Export JSON
      </button>
      <button
        type="button"
        onClick={() => exportProjectExcel()}
        title="Export Excel: ชีต BOQ + Measurements (trace ได้)"
        style={btnStyle()}
      >
        Export Excel
      </button>
      {saveStatus && (
        <span style={{ fontSize: 11, color: '#7dd87d' }}>{saveStatus}</span>
      )}
      <span style={{ flex: 1 }} />
      <button type="button" disabled style={{ padding: '4px 10px', fontSize: 12, color: '#666' }}>
        AI Review
      </button>
    </div>
  );
}

function btnStyle() {
  return {
    padding: '4px 10px',
    fontSize: 12,
    color: '#ddd',
    background: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: 4,
    cursor: 'pointer',
  } as const;
}
