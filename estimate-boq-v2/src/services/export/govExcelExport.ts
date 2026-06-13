/**
 * govExcelExport.ts
 * ─────────────────────────────────────────────────────────────────────────
 * กรอกข้อมูล BOQ ลง Template ราชการ (boq-master.xlsx) ด้วย ExcelJS — ฝั่ง client
 *
 * หลักการ "Load → Fill → Save":
 *   - เปิด master ที่มี layout/สูตร/format/print/รูป/chain ครบ
 *   - เขียนเฉพาะ input cell (meta + ปริมาณ/ราคา + เงื่อนไข Factor F)
 *   - ตั้ง fullCalcOnLoad → Excel คำนวณ chain เองตอนเปิด (ไม่ recalc ใน JS)
 *
 * ⚠️ ห้ามเขียนทับ formula cell (F/H/I แถวรายการ, แถวรวม, factor F, ปร.5/ปร.6 chain)
 *    เลขถูกล็อก deterministic ในชั้น logic แล้วส่งเป็น "number ดิบ" ลงช่อง
 *    ให้ Excel คูณ/รวมตามสูตรใน master (หลัก "โค้ดล็อก")
 *
 * โครงสร้าง section ราชการมีลำดับชั้น: หมวด > หัวข้อย่อย(sub) > รายการ(item)
 * master ฝัง F=C*E ทุกแถวในช่วงหมวด → แถว sub (C ว่าง) ได้ F=0 ไม่กระทบยอดรวม
 *
 * lazy-load:  const { fillBoqTemplate } = await import('./govExcelExport');
 * ─────────────────────────────────────────────────────────────────────────
 */
import ExcelJS from 'exceljs';
import { META_CELLS, BUILDING, EQUIPMENT, FACTOR_F, POR5_CONDITIONS, EQUIPMENT_VAT } from './govExcelMap';

/** หนึ่งแถวใน section: หัวข้อย่อย หรือ รายการที่มีปริมาณ/ราคา */
export type SectionRow =
  | { type: 'sub'; name: string }
  | { type: 'item'; name: string; qty: number; unit: string; matUnit: number; laborUnit: number };

export interface BoqExportData {
  meta: {
    projectName: string; location: string; province: string;
    agency?: string; estimateDate?: string; estimatedBy?: string;
    approver?: string; approverTitle?: string;
  };
  /** รายการอาคารแยกตาม section.code (1–12 ตาม BUILDING.sections) */
  buildingItems: Record<number, SectionRow[]>;
  equipmentItems: SectionRow[];
  factorF: {
    advanceRate: number; retentionRate: number;
    rangeLow: number; rangeHigh: number; fLow: number; fHigh: number;
  };
  conditions?: { loanInterest?: number; vat?: number; equipmentVat?: number };
}

const ref = (s: string): [string, string] => { const [sheet, cell] = s.split('!'); return [sheet, cell]; };

function put(wb: ExcelJS.Workbook, sheet: string, cell: string, value: unknown) {
  if (value === undefined || value === null) return;
  wb.getWorksheet(sheet)!.getCell(cell).value = value as ExcelJS.CellValue;
}

function setMeta(wb: ExcelJS.Workbook, m: BoqExportData['meta']) {
  const map: Record<string, string | undefined> = {
    projectName: m.projectName, location: m.location, province: m.province,
    agency: m.agency, estimateDate: m.estimateDate, estimatedBy: m.estimatedBy,
  };
  for (const [key, targets] of Object.entries(META_CELLS)) {
    if (key === 'approver') continue;
    const val = map[key];
    if (val === undefined) continue;
    for (const [sheet, cell, prefix] of targets as readonly (readonly [string, string, string])[]) {
      put(wb, sheet, cell, `${prefix}${val}`);
    }
  }
  if (m.approver) put(wb, 'ปร 5.ครุภัณฑ์', 'E32', m.approver);
  if (m.approverTitle) put(wb, 'ปร 5.ครุภัณฑ์', 'E33', m.approverTitle);
}

/** เขียน rows (sub|item) เรียงลงช่วง first..last; ล้าง slot ที่เหลือ */
function fillRows(
  ws: ExcelJS.Worksheet,
  rows: SectionRow[],
  first: number, last: number,
  c: { qty: string; unit: string; matUnit: string; laborUnit: string },
  label: string,
) {
  const slots = last - first + 1;
  if (rows.length > slots) {
    throw new Error(`"${label}" มี ${rows.length} แถว เกิน slot ${slots} (ดู README: ขยาย master / insertItemRows)`);
  }
  rows.forEach((row, i) => {
    const r = first + i;
    ws.getCell(`B${r}`).value = row.name;
    if (row.type === 'item') {
      ws.getCell(`${c.qty}${r}`).value = row.qty;
      ws.getCell(`${c.unit}${r}`).value = row.unit;
      ws.getCell(`${c.matUnit}${r}`).value = row.matUnit;
      ws.getCell(`${c.laborUnit}${r}`).value = row.laborUnit;
    }
    // F/H/I = สูตรใน master (=C*E ฯลฯ) — ไม่แตะ
  });
  for (let r = first + rows.length; r <= last; r++) {
    ['B', c.qty, c.unit, c.matUnit, c.laborUnit].forEach((col) => { ws.getCell(`${col}${r}`).value = null; });
  }
}

function setFactorF(wb: ExcelJS.Workbook, f: BoqExportData['factorF'], cond?: BoqExportData['conditions']) {
  put(wb, ...ref(FACTOR_F.advanceRate), f.advanceRate);
  put(wb, ...ref(FACTOR_F.retentionRate), f.retentionRate);
  put(wb, ...ref(FACTOR_F.rangeLow), f.rangeLow);
  put(wb, ...ref(FACTOR_F.rangeHigh), f.rangeHigh);
  put(wb, ...ref(FACTOR_F.fLow), f.fLow);
  put(wb, ...ref(FACTOR_F.fHigh), f.fHigh);
  put(wb, ...ref(POR5_CONDITIONS.advanceRate), f.advanceRate);
  put(wb, ...ref(POR5_CONDITIONS.retentionRate), f.retentionRate);
  if (cond?.loanInterest !== undefined) put(wb, ...ref(POR5_CONDITIONS.loanInterest), cond.loanInterest);
  if (cond?.vat !== undefined) put(wb, ...ref(POR5_CONDITIONS.vat), cond.vat);
  if (cond?.equipmentVat !== undefined) put(wb, ...ref(EQUIPMENT_VAT), cond.equipmentVat);
}

/**
 * กรอก BOQ ลง master แล้วคืน buffer (.xlsx) พร้อมดาวน์โหลด
 * @param masterBuffer  ArrayBuffer ของ boq-master.xlsx
 */
export async function fillBoqTemplate(masterBuffer: ArrayBuffer, data: BoqExportData): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(masterBuffer);

  setMeta(wb, data.meta);

  const wsB = wb.getWorksheet('ปร4.อาคาร')!;
  for (const s of BUILDING.sections) {
    fillRows(wsB, data.buildingItems[s.code] ?? [], s.firstItem, s.lastItem, BUILDING.cols, s.name);
  }

  const wsE = wb.getWorksheet('ปร4.ครุภัณฑ์')!;
  fillRows(wsE, data.equipmentItems, EQUIPMENT.firstItem, EQUIPMENT.lastItem, EQUIPMENT.cols, 'ครุภัณฑ์');

  setFactorF(wb, data.factorF, data.conditions);

  wb.calcProperties.fullCalcOnLoad = true; // ข้อ 10: Excel คำนวณ chain ตอนเปิด
  return wb.xlsx.writeBuffer();
}
