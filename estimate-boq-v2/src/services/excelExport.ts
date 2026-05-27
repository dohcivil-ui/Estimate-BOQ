/**
 * Export BOQ → Excel (.xlsx) ด้วย exceljs
 * - เส้นตารางครบทุก cell
 * - header สีน้ำเงิน + ตัวอักษรขาว
 * - ตัวเลข format #,##0.00
 * - merge cell หัวเรื่อง
 */
import ExcelJS from 'exceljs';
import type { BOQItem, ProjectMeta } from '@/types/boq';
import {
  adjustedQuantity,
  directCostTotal,
  effectiveFactorF,
  marketPrice,
  rowAmount,
  totalsByKind,
} from '@/core/boqCalc';

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF94A3B8' } },
  left: { style: 'thin', color: { argb: 'FF94A3B8' } },
  bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
  right: { style: 'thin', color: { argb: 'FF94A3B8' } },
};

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E40AF' }, // blue-800
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: 'Sarabun',
  size: 11,
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

const BODY_FONT: Partial<ExcelJS.Font> = {
  name: 'Sarabun',
  size: 10,
};

const NUMFMT_QTY = '#,##0.0000';
const NUMFMT_PRICE = '#,##0.00';
const NUMFMT_AMOUNT = '"฿"#,##0.00';

interface ExportOptions {
  items: BOQItem[];
  meta: ProjectMeta;
  fileName?: string;
}

/** สร้างและ download ไฟล์ Excel */
export async function exportBOQToExcel(opts: ExportOptions): Promise<void> {
  const { items, meta } = opts;
  // Factor F: ใช้ตาราง CGD 2567 ตามค่างาน (หรือ override ถ้า meta.factorF > 0)
  const factorF = effectiveFactorF(
    directCostTotal(items),
    meta.factorF,
    meta.advancePct,
    meta.retentionPct,
  );
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Estimate-BOQ v2';
  wb.created = new Date();

  // ─── Sheet 1: BOQ ─────────────────────────────────────────────────────
  const ws = wb.addWorksheet('BOQ', {
    properties: { defaultColWidth: 14 },
    views: [{ state: 'frozen', ySplit: 6 }],
  });

  ws.columns = [
    { key: 'no', width: 5 },
    { key: 'category', width: 16 },
    { key: 'name', width: 38 },
    { key: 'unit', width: 8 },
    { key: 'qty', width: 12 },
    { key: 'waste', width: 8 },
    { key: 'adjQty', width: 12 },
    { key: 'unitPrice', width: 12 },
    { key: 'amount', width: 14 },
    { key: 'kind', width: 8 },
    { key: 'source', width: 12 },
    { key: 'notes', width: 22 },
  ];

  // ─── หัวเอกสาร (3 บรรทัด) ──────────────────────────────────────────────
  ws.mergeCells('A1:L1');
  const t1 = ws.getCell('A1');
  t1.value = `บัญชีรายการ BOQ — ${meta.name || '(ไม่ระบุชื่อโครงการ)'}`;
  t1.font = { name: 'Sarabun', size: 14, bold: true };
  t1.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells('A2:L2');
  const t2 = ws.getCell('A2');
  const metaPieces = [
    meta.client ? `เจ้าของ: ${meta.client}` : '',
    meta.location ? `ที่ตั้ง: ${meta.location}` : '',
    meta.province ? `จังหวัด: ${meta.province}` : '',
  ].filter(Boolean);
  t2.value = metaPieces.join('  ·  ');
  t2.font = { name: 'Sarabun', size: 10, color: { argb: 'FF475569' } };
  t2.alignment = { horizontal: 'center' };

  ws.mergeCells('A3:L3');
  const t3 = ws.getCell('A3');
  t3.value = `วันที่: ${new Date().toLocaleDateString('th-TH')}   Factor F: ${factorF.toFixed(4)}   VAT: ${meta.vatPct}%`;
  t3.font = { name: 'Sarabun', size: 10, color: { argb: 'FF475569' } };
  t3.alignment = { horizontal: 'center' };

  ws.getRow(4).height = 6; // spacing

  // ─── Header row (row 5) ────────────────────────────────────────────────
  const headerRow = ws.getRow(5);
  const headers = [
    '#',
    'หมวด',
    'รายการ',
    'หน่วย',
    'ปริมาณ',
    'เผื่อ %',
    'ปริมาณรวม',
    'ราคา/หน่วย',
    'จำนวนเงิน',
    'ประเภท',
    'ที่มา',
    'หมายเหตุ',
  ];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER_THIN;
  });
  headerRow.height = 28;

  // ─── Data rows ─────────────────────────────────────────────────────────
  items.forEach((it, idx) => {
    const adjQty = adjustedQuantity(it);
    const amount = rowAmount(it);
    const row = ws.addRow({
      no: idx + 1,
      category: it.category,
      name: it.name,
      unit: it.unit,
      qty: it.quantity,
      waste: it.wastePct,
      adjQty,
      unitPrice: it.unitPrice,
      amount,
      kind: it.isMaterial ? 'วัสดุ' : 'ค่าแรง',
      source: sourceLabel(it.source),
      notes: it.notes ?? '',
    });
    row.font = BODY_FONT;
    row.alignment = { vertical: 'middle' };

    row.getCell('no').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('unit').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('kind').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('source').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('qty').numFmt = NUMFMT_QTY;
    row.getCell('adjQty').numFmt = NUMFMT_QTY;
    row.getCell('unitPrice').numFmt = NUMFMT_PRICE;
    row.getCell('amount').numFmt = NUMFMT_AMOUNT;
    row.getCell('waste').numFmt = '0.0"%"';

    // labor = สีน้ำตาลอ่อน, material = สีฟ้าอ่อน
    const fillColor = it.isMaterial ? 'FFEFF6FF' : 'FFFEF3C7';
    for (let c = 1; c <= 12; c++) {
      const cell = row.getCell(c);
      cell.border = BORDER_THIN;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillColor },
      };
    }
  });

  // ─── Totals ────────────────────────────────────────────────────────────
  const totals = totalsByKind(items);
  const market = marketPrice(totals.total, factorF);
  const vat = market * (meta.vatPct / 100);

  ws.addRow([]);
  const addTotalRow = (label: string, value: number, bold = false, color = 'FFFFFFFF') => {
    const r = ws.addRow(['', '', '', '', '', '', '', label, value, '', '', '']);
    r.font = { name: 'Sarabun', size: 11, bold };
    r.alignment = { vertical: 'middle' };
    r.getCell(8).alignment = { horizontal: 'right' };
    r.getCell(9).alignment = { horizontal: 'right' };
    r.getCell(9).numFmt = NUMFMT_AMOUNT;
    for (let c = 1; c <= 12; c++) {
      const cell = r.getCell(c);
      cell.border = BORDER_THIN;
      if (c >= 8 && c <= 9) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color },
        };
      }
    }
  };
  addTotalRow('รวมค่าแรง', totals.labor, false, 'FFFEF3C7');
  addTotalRow('รวมค่าวัสดุ', totals.material, false, 'FFEFF6FF');
  addTotalRow('Direct Cost', totals.total, true, 'FFE2E8F0');
  addTotalRow(`× Factor F (${factorF.toFixed(4)})`, market, true, 'FFDCFCE7');
  addTotalRow(`+ VAT ${meta.vatPct}%`, vat);
  addTotalRow('ราคารวมสุทธิ', market + vat, true, 'FFFEF08A');

  // ─── Sheet 2: Measurements (Step 2.6 จะใส่จริง, ตอนนี้ stub) ──────────

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    opts.fileName ?? defaultFileName(meta),
  );
}

function sourceLabel(s: BOQItem['source']): string {
  switch (s) {
    case 'manual':
      return 'มือ';
    case 'preset':
      return 'ว.809';
    case 'ai':
      return 'AI';
    case 'measurement':
      return 'วัด';
  }
}

function defaultFileName(meta: ProjectMeta): string {
  const safe = (meta.name || 'โปรเจกต์ประมาณราคา').replace(/[\\/:*?"<>|]/g, '_');
  const date = new Date().toISOString().slice(0, 10);
  return `BOQ-${safe}-${date}.xlsx`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
