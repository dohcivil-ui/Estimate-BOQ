/**
 * BOQPanel — top-level panel ของ tab "BOQ" ใน SidePanel
 * - ProjectMetaForm
 * - Toolbar (add preset / manual / from measurement / AI import / GPT export / Excel / print / undo/redo)
 * - BOQTable
 * - Totals summary
 */
import { useState } from 'react';
import { useBOQStore } from '@/stores/boqStore';
import { useProjectMeta } from '@/stores/projectMetaStore';
import { useMeasurementStore } from '@/stores/measurementStore';
import {
  directCostTotal,
  formatCurrency,
  totalsByKind,
} from '@/core/boqCalc';
import { ProjectMetaForm } from './ProjectMetaForm';
import { BOQTable } from './BOQTable';
import { Por4Table } from './Por4Table';
import { Por456View } from './Por456Summary';
import { AddPresetMenu } from './AddPresetMenu';
import { AIImportModal } from './AIImportModal';
import { GPTExportModal } from './GPTExportModal';
import { CreateFromMeasurementsModal } from './CreateFromMeasurementsModal';
import { SyncPricesModal } from './SyncPricesModal';
import { exportBOQToExcel } from '@/services/excelExport';
import { exportGovBOQ, type GovExportMode } from '@/services/govExcelExport';
import { printBOQ } from '@/services/printPdf';

type BOQView = 'edit' | 'por4' | 'por5' | 'por6';

const VIEW_TABS: Array<{ id: BOQView; label: string }> = [
  { id: 'edit', label: '✏️ แก้ไข BOQ' },
  { id: 'por4', label: '📑 ปร.4' },
  { id: 'por5', label: '📊 ปร.5' },
  { id: 'por6', label: '📋 ปร.6' },
];

export function BOQPanel() {
  const items = useBOQStore((s) => s.items);
  const add = useBOQStore((s) => s.add);
  const removeAll = useBOQStore((s) => s.removeAll);
  const undo = useBOQStore((s) => s.undo);
  const redo = useBOQStore((s) => s.redo);
  const canUndo = useBOQStore((s) => s.past.length > 0);
  const canRedo = useBOQStore((s) => s.future.length > 0);
  const measurements = useMeasurementStore((s) => s.measurements);
  const priceSyncWarnings = useBOQStore((s) => s.priceSyncWarnings);
  const clearPriceWarnings = useBOQStore((s) => s.setPriceSyncWarnings);

  const [showAIImport, setShowAIImport] = useState(false);
  const [showGPTExport, setShowGPTExport] = useState(false);
  const [showCreateFromMeas, setShowCreateFromMeas] = useState(false);
  const [showSyncPrices, setShowSyncPrices] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [view, setView] = useState<BOQView>('edit');

  const totals = totalsByKind(items);
  const direct = directCostTotal(items);

  const handleAddManual = () => {
    const now = new Date().toISOString();
    add({
      id: crypto.randomUUID(),
      category: 'อื่นๆ',
      name: 'รายการใหม่',
      unit: 'หน่วย',
      quantity: 0,
      unitPrice: 0,
      isMaterial: false,
      wastePct: 0,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    });
  };

  const handleExcel = async (variant: 'classic' | GovExportMode) => {
    setExportMenuOpen(false);
    setExporting(true);
    try {
      // ★ ดึงจาก store ปัจจุบันเสมอ (ไม่ใช้ items/meta ที่ค้างจาก render scope)
      const freshItems = useBOQStore.getState().getAllItems();
      const freshMeta = useProjectMeta.getState();
      if (variant === 'classic') {
        await exportBOQToExcel({ items: freshItems, meta: freshMeta });
      } else {
        // ปร.4 แยกหมวดตาม discipline → ต้อง stamp discipline ลงแต่ละ item
        const itemsWithDiscipline =
          useBOQStore.getState().getAllItemsWithDiscipline();
        await exportGovBOQ({
          items: itemsWithDiscipline,
          meta: freshMeta,
          mode: variant,
          // เลือกตาราง Factor F CGD 2567 (เก็บเป็นเศษส่วนตามที่ export ต้องการ)
          advancePayment: (freshMeta.advancePct ?? 0) / 100,
          retention: (freshMeta.retentionPct ?? 0) / 100,
        });
      }
    } catch (err) {
      alert(`Export ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3" data-print-root>
      <ProjectMetaForm />

      {/* toolbar */}
      <div
        className="flex flex-wrap items-center gap-1.5 rounded border border-bg-border bg-bg-raised p-2"
        data-print-hide
      >
        <button
          type="button"
          onClick={handleAddManual}
          className="rounded border border-bg-border bg-bg-panel px-2.5 py-1 text-xs text-ink-primary hover:bg-bg-hover"
        >
          ＋ เพิ่มแถว
        </button>
        <AddPresetMenu />
        <button
          type="button"
          onClick={() => setShowCreateFromMeas(true)}
          disabled={measurements.length === 0}
          className="rounded border border-bg-border bg-bg-panel px-2.5 py-1 text-xs text-ink-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          title={measurements.length === 0 ? 'ยังไม่มีค่าวัด' : 'สร้าง BOQ จากรายการวัด'}
        >
          📐 จากค่าวัด
        </button>

        <span className="mx-1 h-5 w-px bg-bg-border" />

        <button
          type="button"
          onClick={() => setShowGPTExport(true)}
          className="rounded border border-bg-border bg-bg-panel px-2.5 py-1 text-xs text-ink-primary hover:bg-bg-hover"
          title="คัดลอกค่าวัดเป็นข้อความ ส่งให้ Custom GPT"
        >
          📋 ส่งไป GPT
        </button>
        <button
          type="button"
          onClick={() => setShowAIImport(true)}
          className="rounded border border-bg-border bg-bg-panel px-2.5 py-1 text-xs text-ink-primary hover:bg-bg-hover"
          title="วาง JSON จาก Custom GPT เพื่อนำเข้า BOQ"
        >
          🤖 นำเข้า AI
        </button>
        <button
          type="button"
          onClick={() => setShowSyncPrices(true)}
          disabled={items.length === 0}
          className="rounded border border-bg-border bg-bg-panel px-2.5 py-1 text-xs text-ink-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          title="ดึงราคาจังหวัด (จาก material_prices ที่ admin บันทึก)"
        >
          🔄 ราคาจังหวัด
        </button>

        <span className="mx-1 h-5 w-px bg-bg-border" />

        <ExcelExportDropdown
          open={exportMenuOpen}
          setOpen={setExportMenuOpen}
          disabled={items.length === 0 || exporting}
          busy={exporting}
          onExport={handleExcel}
        />
        <button
          type="button"
          onClick={printBOQ}
          disabled={items.length === 0}
          className="rounded border border-bg-border bg-bg-panel px-2.5 py-1 text-xs text-ink-primary hover:bg-bg-hover disabled:opacity-50"
        >
          🖨️ พิมพ์ PDF
        </button>

        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="rounded px-1.5 py-1 text-xs text-ink-secondary hover:text-ink-primary disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="rounded px-1.5 py-1 text-xs text-ink-secondary hover:text-ink-primary disabled:opacity-30"
            title="Redo (Ctrl+Y)"
          >
            ↷
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`ลบทั้งหมด ${items.length} รายการ?`)) removeAll();
              }}
              className="rounded px-1.5 py-1 text-xs text-danger hover:bg-danger/10"
              title="ล้างทั้งหมด"
            >
              🗑️
            </button>
          )}
        </span>
      </div>

      {priceSyncWarnings.length > 0 && (
        <div
          className="rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning"
          data-print-hide
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">
              ⚠️ ราคา/ค่าแรง {priceSyncWarnings.length} รายการต้องตรวจ
            </span>
            <button
              type="button"
              onClick={() => clearPriceWarnings([])}
              className="text-warning/70 hover:text-warning"
              aria-label="ปิด"
            >
              ✕
            </button>
          </div>
          <ul className="max-h-32 list-disc space-y-0.5 overflow-y-auto pl-4">
            {priceSyncWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* toggle มุมมอง: แก้ไข BOQ | ปร.4 | ปร.5 | ปร.6 */}
      <div className="flex items-center justify-between gap-2" data-print-hide>
        <div className="inline-flex flex-wrap rounded border border-bg-border bg-bg-raised p-0.5">
          {VIEW_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                view === t.id
                  ? 'bg-accent/20 font-medium text-accent'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {view === 'edit' && (
          <div className="flex items-center gap-3 text-[10px] text-ink-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500/40" />
              วัสดุ
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/40" />
              ค่าแรง
            </span>
          </div>
        )}
      </div>

      {view === 'edit' && <BOQTable />}
      {view === 'por4' && <Por4Table />}
      {view === 'por5' && <Por456View mode="por5" />}
      {view === 'por6' && <Por456View mode="por6" />}

      {view === 'edit' && items.length > 0 && (
        <div
          className="space-y-1 rounded border border-bg-border bg-bg-raised p-3 text-xs"
          data-print-totals
        >
          <TotalsRow label="รวมค่าแรง" value={totals.labor} />
          <TotalsRow label="รวมค่าวัสดุ" value={totals.material} />
          <div className="border-t border-bg-border pt-1">
            <TotalsRow label="Direct Cost" value={direct} bold />
          </div>
        </div>
      )}

      {showAIImport && <AIImportModal onClose={() => setShowAIImport(false)} />}
      {showGPTExport && <GPTExportModal onClose={() => setShowGPTExport(false)} />}
      {showCreateFromMeas && (
        <CreateFromMeasurementsModal onClose={() => setShowCreateFromMeas(false)} />
      )}
      {showSyncPrices && (
        <SyncPricesModal onClose={() => setShowSyncPrices(false)} />
      )}
    </div>
  );
}

function TotalsRow({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: number;
  bold?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={color ?? 'text-ink-secondary'}>{label}</span>
      <span className={`font-mono ${color ?? 'text-ink-primary'} ${bold ? 'font-bold' : ''}`}>
        ฿ {formatCurrency(value)}
      </span>
    </div>
  );
}

type ExcelVariant = 'classic' | GovExportMode;

function ExcelExportDropdown({
  open,
  setOpen,
  disabled,
  busy,
  onExport,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  disabled: boolean;
  busy: boolean;
  onExport: (variant: ExcelVariant) => void;
}) {
  const items: Array<{
    id: ExcelVariant;
    label: string;
    desc: string;
    highlight?: boolean;
  }> = [
    {
      id: 'full',
      label: '📋 ปร.4 + ปร.5 + ปร.6 + Factor F (ครบชุด)',
      desc: 'ราคากลางมาตรฐานกรมบัญชีกลาง — 4 sheets พร้อม cross-sheet formula',
      highlight: true,
    },
    {
      id: 'por4',
      label: '📑 ปร.4(ก) อย่างเดียว',
      desc: 'แบบแสดงรายการ ปริมาณงาน และราคา',
    },
    {
      id: 'classic',
      label: '🗒️ BOQ แบบเดิม',
      desc: 'ตารางเดียว ครบทุก field (รวม source/หมายเหตุ)',
    },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-1 rounded bg-success/20 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/30 disabled:opacity-50"
        title="เลือกรูปแบบ Excel ที่จะ export"
      >
        {busy ? 'กำลัง export…' : '📊 Excel'}
        {!busy && <span className="ml-0.5 text-[10px] opacity-70">▾</span>}
      </button>

      {open && !disabled && (
        <>
          <button
            type="button"
            aria-label="ปิด"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />
          <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded border border-bg-border bg-bg-panel p-1 shadow-xl">
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => onExport(it.id)}
                className={`flex w-full flex-col items-start gap-0.5 rounded px-2.5 py-2 text-left transition-colors hover:bg-bg-hover ${
                  it.highlight
                    ? 'bg-success/10 hover:bg-success/20'
                    : ''
                }`}
              >
                <span className="text-xs font-medium text-ink-primary">
                  {it.label}
                </span>
                <span className="text-[10px] leading-tight text-ink-muted">
                  {it.desc}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
