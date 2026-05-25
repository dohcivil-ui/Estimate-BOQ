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
  marketPrice,
  totalsByKind,
} from '@/core/boqCalc';
import { ProjectMetaForm } from './ProjectMetaForm';
import { BOQTable } from './BOQTable';
import { AddPresetMenu } from './AddPresetMenu';
import { AIImportModal } from './AIImportModal';
import { GPTExportModal } from './GPTExportModal';
import { CreateFromMeasurementsModal } from './CreateFromMeasurementsModal';
import { SyncPricesModal } from './SyncPricesModal';
import { exportBOQToExcel } from '@/services/excelExport';
import { printBOQ } from '@/services/printPdf';

export function BOQPanel() {
  const items = useBOQStore((s) => s.items);
  const add = useBOQStore((s) => s.add);
  const removeAll = useBOQStore((s) => s.removeAll);
  const undo = useBOQStore((s) => s.undo);
  const redo = useBOQStore((s) => s.redo);
  const canUndo = useBOQStore((s) => s.past.length > 0);
  const canRedo = useBOQStore((s) => s.future.length > 0);
  const measurements = useMeasurementStore((s) => s.measurements);
  const meta = useProjectMeta();

  const [showAIImport, setShowAIImport] = useState(false);
  const [showGPTExport, setShowGPTExport] = useState(false);
  const [showCreateFromMeas, setShowCreateFromMeas] = useState(false);
  const [showSyncPrices, setShowSyncPrices] = useState(false);
  const [exporting, setExporting] = useState(false);

  const totals = totalsByKind(items);
  const direct = directCostTotal(items);
  const market = marketPrice(direct, meta.factorF);
  const vat = market * (meta.vatPct / 100);
  const grand = market + vat;

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

  const handleExcel = async () => {
    setExporting(true);
    try {
      await exportBOQToExcel({ items, meta });
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

        <button
          type="button"
          onClick={handleExcel}
          disabled={items.length === 0 || exporting}
          className="rounded bg-success/20 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/30 disabled:opacity-50"
        >
          {exporting ? 'กำลัง export…' : '📊 Excel'}
        </button>
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

      <BOQTable />

      {items.length > 0 && (
        <div
          className="space-y-1 rounded border border-bg-border bg-bg-raised p-3 text-xs"
          data-print-totals
        >
          <TotalsRow label="รวมค่าแรง" value={totals.labor} />
          <TotalsRow label="รวมค่าวัสดุ" value={totals.material} />
          <div className="border-t border-bg-border pt-1">
            <TotalsRow label="Direct Cost" value={direct} bold />
          </div>
          <TotalsRow
            label={`× Factor F (${meta.factorF.toFixed(4)})`}
            value={market}
            bold
            color="text-success"
          />
          <TotalsRow label={`+ VAT ${meta.vatPct}%`} value={vat} />
          <div className="mt-1 rounded bg-warning/10 px-2 py-1.5">
            <TotalsRow label="ราคารวมสุทธิ" value={grand} bold color="text-warning" />
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
