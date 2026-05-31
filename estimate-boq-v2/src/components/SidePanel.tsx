/**
 * SidePanel — 4 tabs: 📋 รายการวัด / 🤖 AI / 💰 BOQ / 🛠️ เครื่องมือ
 * Active tab อยู่ใน uiStore (เพื่อให้ component อื่น เช่น TopBar กดสลับได้)
 */
import { useUIStore, type SidePanelTab } from '@/stores/uiStore';
import { MeasurementsTable } from './MeasurementsTable';
import { RotateControls } from './RotateControls';
import { SnapControls } from './SnapControls';
import { BOQPanel } from './boq/BOQPanel';
import { AIPanel } from './ai/AIPanel';
import { PaintPanel } from './PaintPanel';
import { DevPdfProbe } from './DevPdfProbe';

const TABS: { id: SidePanelTab; label: string }[] = [
  { id: 'measure', label: '📋 วัด' },
  { id: 'ai', label: '🤖 AI' },
  { id: 'boq', label: '💰 BOQ' },
  { id: 'paint', label: '🎨 ระบาย' },
  { id: 'tools', label: '🛠️ tools' },
];

export function SidePanel() {
  const tab = useUIStore((s) => s.sidePanelTab);
  const setTab = useUIStore((s) => s.setSidePanelTab);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b border-bg-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 px-1.5 py-2 text-[11px] font-medium transition-colors ${
              tab === t.id
                ? 'border-b-2 border-accent bg-bg-raised text-ink-primary'
                : 'border-b-2 border-transparent text-ink-secondary hover:bg-bg-hover'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 text-sm">
        {tab === 'measure' && <MeasurementsTable />}
        {tab === 'ai' && <AIPanel />}
        {tab === 'boq' && <BOQPanel />}
        {tab === 'paint' && <PaintPanel />}
        {tab === 'tools' && (
          <div className="space-y-5">
            <RotateControls />
            <div className="border-t border-bg-border pt-3">
              <SnapControls />
            </div>
            <div className="border-t border-bg-border pt-3">
              <DevPdfProbe />
            </div>
            <div className="border-t border-bg-border pt-3 text-[11px] text-ink-muted">
              <p className="mb-1 font-semibold text-ink-secondary">⌨️ คีย์ลัด</p>
              <ul className="space-y-0.5">
                <li><kbd className="kb">F3</kbd> Snap · <kbd className="kb">F8</kbd> Ortho · <kbd className="kb">Shift</kbd> ortho ชั่วคราว</li>
                <li><kbd className="kb">Enter</kbd> จบ · <kbd className="kb">Esc</kbd> ยกเลิก · <kbd className="kb">⌫</kbd> ถอยจุด</li>
                <li><kbd className="kb">Ctrl+Z</kbd>/<kbd className="kb">Ctrl+Y</kbd> undo/redo · <kbd className="kb">Del</kbd> ลบที่เลือก</li>
                <li><kbd className="kb">F</kbd>/<kbd className="kb">0</kbd> Fit · <kbd className="kb">ล้อ</kbd> ซูม</li>
                <li><kbd className="kb">V</kbd> เลือก · <kbd className="kb">H</kbd> เลื่อน · <kbd className="kb">K</kbd> สเกล</li>
                <li><kbd className="kb">L</kbd> ความยาว · <kbd className="kb">A</kbd> พื้นที่ · <kbd className="kb">C</kbd> นับ</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
