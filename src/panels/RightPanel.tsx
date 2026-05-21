import { useState } from 'react';

type Tab = 'measurements' | 'boq' | 'ai';

const TABS: { id: Tab; label: string; phase: number }[] = [
  { id: 'measurements', label: 'Measurements', phase: 3 },
  { id: 'boq', label: 'BOQ', phase: 4 },
  { id: 'ai', label: 'AI', phase: 5 },
];

export function RightPanel() {
  const [tab, setTab] = useState<Tab>('measurements');

  return (
    <div
      style={{
        width: 280,
        background: '#171717',
        borderLeft: '1px solid #2a2a2a',
        color: '#ddd',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', borderBottom: '1px solid #2a2a2a' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: 12,
              background: tab === t.id ? '#1f1f1f' : 'transparent',
              color: tab === t.id ? '#fff' : '#888',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #5b9dff' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 12, fontSize: 12, color: '#888', overflowY: 'auto', flex: 1 }}>
        {tab === 'measurements' && <p>ตาราง measurement จะถูกเติมใน Phase 3</p>}
        {tab === 'boq' && <p>รายการ BOQ จะถูกเติมใน Phase 4</p>}
        {tab === 'ai' && <p>AI suggestions จะถูกเติมใน Phase 5 (mock)</p>}
      </div>
    </div>
  );
}
