/**
 * Export BOQ → Excel ตามมาตรฐานกรมบัญชีกลาง (4 sheets)
 *
 *   Sheet 1  "Factor F"   ตารางคำนวณ Factor F (24 brackets + INDEX/MATCH)
 *   Sheet 2  "ปร.4(ก)"     รายการปริมาณงานและราคา (BOQ ละเอียด 12 cols)
 *   Sheet 3  "ปร.5"        สรุปราคาค่าก่อสร้าง (ต้นทุน × Factor F)
 *   Sheet 4  "ปร.6"        สรุปค่าก่อสร้าง (ราคาสุดท้าย + bahtText + ลายเซ็น)
 *
 * Cross-sheet formulas:
 *   'Factor F'!D42  = 'ปร.4(ก)'!K{grand}           ค่างานต้นทุน
 *   'ปร.5'!I8       = 'ปร.4(ก)'!K{grand}           ค่างานต้นทุน
 *   'ปร.5'!J8       = 'Factor F'!D53                Factor F ที่ใช้จริง
 *   'ปร.5'!K8       = I8*J8                         ค่าก่อสร้าง
 *   'ปร.6'!H9       = 'ปร.5'!K16                    รวมค่าก่อสร้าง
 *
 * Library: exceljs (มีอยู่แล้วใน dependencies)
 */
import ExcelJS from 'exceljs';
import type { BOQItem, ProjectMeta } from '@/types/boq';
import { adjustedQuantity } from '@/core/boqCalc';

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

export type GovExportMode = 'full' | 'por4';

export interface GovExportOptions {
  items: BOQItem[];
  meta: ProjectMeta;
  /** ชื่อหน่วยงานเจ้าของโครงการ (ถ้าไม่ระบุ ใช้ meta.client) */
  agency?: string;
  /** ชื่อผู้ประมาณราคา */
  estimatorName?: string;
  /** ตำแหน่งผู้ประมาณราคา */
  estimatorTitle?: string;
  /** ตำแหน่งผู้รับรอง (ถ้ามี — แสดงในช่องลายเซ็น) */
  reviewerTitle?: string;
  /** ตำแหน่งผู้ตรวจสอบ */
  inspectorTitle?: string;
  /** งบประมาณเป้า (ถ้ามี — แสดงในส่วนเปรียบเทียบ ปร.5) */
  budget?: number;
  /** ดอกเบี้ยเงินกู้ (default 0.06 = 6%) */
  interestRate?: number;
  /** เงินล่วงหน้าจ่าย (default 0) */
  advancePayment?: number;
  /** เงินประกันผลงานหัก (default 0) */
  retention?: number;
  mode?: GovExportMode;
  fileName?: string;
}

/** สร้างและ download ไฟล์ Excel ตามรูปแบบกรมบัญชีกลาง */
export async function exportGovBOQ(opts: GovExportOptions): Promise<void> {
  const mode = opts.mode ?? 'full';
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Estimate-BOQ v2';
  wb.created = new Date();
  wb.title = `BOQ ปร.456 — ${opts.meta.name || 'โปรเจกต์'}`;

  // ─── Full mode → 4 sheets ในลำดับ: Factor F → ปร.4(ก) → ปร.5 → ปร.6 ───
  // เพิ่ม worksheet ตามลำดับที่ต้องการก่อน แล้วค่อย populate ตาม dependency
  if (mode === 'full') {
    const wsFactor = wb.addWorksheet('Factor F');
    const wsPor4 = wb.addWorksheet('ปร.4(ก)');
    const wsPor5 = wb.addWorksheet('ปร.5');
    const wsPor6 = wb.addWorksheet('ปร.6');

    // populate ตาม dependency: ปร.4 ก่อน (sheet อื่นอ้างยอดรวมจากนี่)
    const por4Refs = buildPor4(wsPor4, opts);
    buildFactorF(wsFactor, opts, por4Refs);
    const por5Refs = buildPor5(wsPor5, opts, por4Refs);
    buildPor6(wsPor6, opts, por5Refs);
  } else {
    // por4 only — sheet เดียว
    const wsPor4 = wb.addWorksheet('ปร.4(ก)');
    buildPor4(wsPor4, opts);
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    opts.fileName ?? defaultFileName(opts.meta, mode),
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Section grouping — รักษาลำดับ category ตามที่ user สร้างจริง
// ═══════════════════════════════════════════════════════════════════════

interface Section {
  letter: string; // A, B, C, ...
  category: string;
  items: BOQItem[];
}

function groupSections(items: BOQItem[]): Section[] {
  const order: string[] = [];
  const buckets: Record<string, BOQItem[]> = {};

  for (const it of items) {
    const cat = (it.category || 'รายการงาน').trim() || 'รายการงาน';
    if (!(cat in buckets)) {
      buckets[cat] = [];
      order.push(cat);
    }
    buckets[cat]!.push(it);
  }

  return order.map((cat, idx) => ({
    letter: String.fromCharCode(65 + idx), // A=65
    category: cat,
    items: buckets[cat]!,
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// bahtText — แปลงตัวเลขเป็นภาษาไทย (สำหรับ ปร.6)
// ═══════════════════════════════════════════════════════════════════════

const TH_DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const TH_PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

/**
 * อ่านจำนวนเต็ม 0-999999 เป็นภาษาไทย
 *  - เอ็ด (หลักหน่วย) เมื่อมีหลักสิบหรือสูงกว่า
 *  - สิบ (ไม่มี "หนึ่งสิบ")
 *  - ยี่สิบ (ไม่ใช่ "สองสิบ")
 */
function readGroup(n: number): string {
  if (n === 0) return '';
  const s = String(n);
  const len = s.length;
  let result = '';
  for (let i = 0; i < len; i++) {
    const d = Number.parseInt(s[i]!, 10);
    const place = len - 1 - i; // 0 = หลักหน่วย
    if (d === 0) continue;

    if (place === 0) {
      // หลักหน่วย: ใช้ "เอ็ด" เมื่อมีหลักสิบขึ้นไป (len > 1)
      result += d === 1 && len > 1 ? 'เอ็ด' : TH_DIGITS[d]!;
    } else if (place === 1) {
      // หลักสิบ: "สิบ", "ยี่สิบ", หรือ "สามสิบ"...
      if (d === 1) result += 'สิบ';
      else if (d === 2) result += 'ยี่สิบ';
      else result += TH_DIGITS[d]! + 'สิบ';
    } else {
      result += TH_DIGITS[d]! + TH_PLACES[place]!;
    }
  }
  return result;
}

/**
 * แปลงจำนวนเงิน (บาท) เป็นข้อความภาษาไทย
 *  - ปัดเป็นจำนวนเต็มก่อน (ตามสเปก)
 *  - มี satang ก็แปลงด้วย ถ้าไม่มี ลงท้ายด้วย "ถ้วน"
 *
 * ตัวอย่าง:
 *   bahtText(0)        → "ศูนย์บาทถ้วน"
 *   bahtText(1)        → "หนึ่งบาทถ้วน"
 *   bahtText(21)       → "ยี่สิบเอ็ดบาทถ้วน"
 *   bahtText(499516)   → "สี่แสนเก้าหมื่นเก้าพันห้าร้อยสิบหกบาทถ้วน"
 *   bahtText(1000000)  → "หนึ่งล้านบาทถ้วน"
 *   bahtText(21000000) → "ยี่สิบเอ็ดล้านบาทถ้วน"
 *   bahtText(100.50)   → "หนึ่งร้อยบาทห้าสิบสตางค์"
 */
export function bahtText(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const baht = Math.floor(abs);
  const satang = Math.round((abs - baht) * 100);

  let bahtPart = '';
  if (baht === 0) {
    bahtPart = 'ศูนย์';
  } else if (baht >= 1_000_000) {
    const millions = Math.floor(baht / 1_000_000);
    const rest = baht % 1_000_000;
    bahtPart = readGroup(millions) + 'ล้าน';
    if (rest > 0) bahtPart += readGroup(rest);
  } else {
    bahtPart = readGroup(baht);
  }

  let result: string;
  if (satang > 0) {
    result = `${bahtPart}บาท${readGroup(satang)}สตางค์`;
  } else {
    result = `${bahtPart}บาทถ้วน`;
  }
  return negative ? `ลบ${result}` : result;
}

// ═══════════════════════════════════════════════════════════════════════
// Styling constants
// ═══════════════════════════════════════════════════════════════════════

const FONT_BODY: Partial<ExcelJS.Font> = { name: 'TH SarabunPSK', size: 14 };
const FONT_BOLD: Partial<ExcelJS.Font> = {
  name: 'TH SarabunPSK',
  size: 14,
  bold: true,
};
const FONT_TITLE: Partial<ExcelJS.Font> = {
  name: 'TH SarabunPSK',
  size: 16,
  bold: true,
};
const FONT_SUB: Partial<ExcelJS.Font> = {
  name: 'TH SarabunPSK',
  size: 14,
  bold: true,
};
const FONT_ITALIC: Partial<ExcelJS.Font> = {
  name: 'TH SarabunPSK',
  size: 14,
  italic: true,
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF7F7F7F' } },
  left: { style: 'thin', color: { argb: 'FF7F7F7F' } },
  bottom: { style: 'thin', color: { argb: 'FF7F7F7F' } },
  right: { style: 'thin', color: { argb: 'FF7F7F7F' } },
};

const BORDER_DOUBLE_TOP: Partial<ExcelJS.Borders> = {
  ...BORDER_THIN,
  top: { style: 'double', color: { argb: 'FF000000' } },
};

const FILL_HEADER: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFDBEEF4' }, // light blue
};
const FILL_SECTION: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF2CC' }, // light yellow
};
const FILL_GRAND: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE2EFDA' }, // light green
};
const FILL_INPUT: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFDBEEF4' }, // light blue for input cells
};
const FILL_HIGHLIGHT: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFEB9C' }, // yellow highlight
};

const NUMFMT_MONEY = '#,##0;-#,##0;"-"';
const NUMFMT_FACTOR = '0.0000';
const NUMFMT_PCT = '0.00%';

// ═══════════════════════════════════════════════════════════════════════
// Sheet 1: Factor F
// ═══════════════════════════════════════════════════════════════════════

const FACTOR_F_TABLE: Array<[number, number, number]> = [
  // [lower, upper, factorF]
  [0, 500_000, 1.3074],
  [500_000, 1_000_000, 1.3074],
  [1_000_000, 2_000_000, 1.305],
  [2_000_000, 5_000_000, 1.3035],
  [5_000_000, 10_000_000, 1.3003],
  [10_000_000, 15_000_000, 1.2943],
  [15_000_000, 20_000_000, 1.2594],
  [20_000_000, 25_000_000, 1.2518],
  [25_000_000, 30_000_000, 1.2248],
  [30_000_000, 40_000_000, 1.2164],
  [40_000_000, 50_000_000, 1.2161],
  [50_000_000, 60_000_000, 1.2159],
  [60_000_000, 70_000_000, 1.2061],
  [70_000_000, 80_000_000, 1.205],
  [80_000_000, 90_000_000, 1.205],
  [90_000_000, 100_000_000, 1.2049],
  [100_000_000, 150_000_000, 1.2049],
  [150_000_000, 200_000_000, 1.2023],
  [200_000_000, 250_000_000, 1.2023],
  [250_000_000, 300_000_000, 1.2013],
  [300_000_000, 350_000_000, 1.1951],
  [350_000_000, 400_000_000, 1.1866],
  [400_000_000, 500_000_000, 1.1858],
  [500_000_000, 1_000_000_000, 1.1853],
];

interface FactorFRefs {
  /** cell ของ "Factor F ที่จะใช้จริง" — sheet อื่นอ้างมาจากนี่ */
  finalFactorCell: string;
  /** cell ของ "เงินล่วงหน้าจ่าย" — D7 */
  advanceCell: string;
  retentionCell: string;
  interestCell: string;
  vatCell: string;
}

function buildFactorF(
  ws: ExcelJS.Worksheet,
  opts: GovExportOptions,
  por4: Por4Refs,
): FactorFRefs {
  const { meta } = opts;

  ws.pageSetup.paperSize = 9;
  ws.pageSetup.orientation = 'portrait';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.margins = standardMargins();

  ws.columns = [
    { key: 'A', width: 40 },
    { key: 'B', width: 18 },
    { key: 'C', width: 14 },
    { key: 'D', width: 18 },
    { key: 'E', width: 18 },
  ];

  // ─── หัวเอกสาร (rows 1-4) ──────────────────────────────────────────────
  mergeAndSet(ws, 'A1:E1', 'ตารางแสดงการคำนวณหาค่า FACTOR F งานอาคาร', {
    font: FONT_TITLE,
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  mergeAndSet(ws, 'A2:E2', meta.name || '[ระบุชื่อโครงการ]', {
    font: FONT_SUB,
    alignment: { horizontal: 'center' },
  });
  mergeAndSet(ws, 'A3:E3', `สถานที่ก่อสร้าง ${meta.location || '[ระบุ]'}`, {
    font: FONT_BODY,
  });
  mergeAndSet(
    ws,
    'A4:E4',
    `หน่วยงาน ${opts.agency ?? meta.client ?? '[ระบุ]'}`,
    { font: FONT_BODY },
  );

  // ─── เงื่อนไข (rows 6-10) ───────────────────────────────────────────────
  setCell(ws, 'A6', 'เงื่อนไข', { font: FONT_BOLD });

  const advanceRow = 7;
  setCell(ws, `A${advanceRow}`, 'เงินล่วงหน้าจ่าย (ร้อยละ)', {
    font: FONT_BODY,
  });
  setCellNumber(ws, `D${advanceRow}`, opts.advancePayment ?? 0, NUMFMT_PCT, {
    font: FONT_BODY,
    fill: FILL_INPUT,
    border: BORDER_THIN,
    alignment: { horizontal: 'right' },
  });

  const retentionRow = 8;
  setCell(ws, `A${retentionRow}`, 'ค่าประกันผลงาน หัก (ร้อยละ)', {
    font: FONT_BODY,
  });
  setCellNumber(ws, `D${retentionRow}`, opts.retention ?? 0, NUMFMT_PCT, {
    font: FONT_BODY,
    fill: FILL_INPUT,
    border: BORDER_THIN,
    alignment: { horizontal: 'right' },
  });

  const interestRow = 9;
  setCell(ws, `A${interestRow}`, 'ดอกเบี้ยเงินกู้ (ร้อยละ)', { font: FONT_BODY });
  setCellNumber(ws, `D${interestRow}`, opts.interestRate ?? 0.06, NUMFMT_PCT, {
    font: FONT_BODY,
    fill: FILL_INPUT,
    border: BORDER_THIN,
    alignment: { horizontal: 'right' },
  });

  const vatRow = 10;
  setCell(ws, `A${vatRow}`, 'ค่าภาษีมูลค่าเพิ่ม VAT (ร้อยละ)', {
    font: FONT_BODY,
  });
  setCellNumber(ws, `D${vatRow}`, meta.vatPct / 100, NUMFMT_PCT, {
    font: FONT_BODY,
    fill: FILL_INPUT,
    border: BORDER_THIN,
    alignment: { horizontal: 'right' },
  });

  // ─── ตาราง Factor F มาตรฐาน (rows 12-37) ──────────────────────────────
  setCell(ws, 'A12', 'ตารางค่า Factor F มาตรฐาน (สำนักงบประมาณ)', {
    font: FONT_BOLD,
  });

  const TABLE_HEADER = 13;
  const TABLE_START = 14;
  const TABLE_END = TABLE_START + FACTOR_F_TABLE.length - 1;

  setCell(ws, `A${TABLE_HEADER}`, 'ค่างานต้นทุน (บาท)', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    border: BORDER_THIN,
    alignment: { horizontal: 'center' },
  });
  setCell(ws, `B${TABLE_HEADER}`, 'ถึง (บาท)', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    border: BORDER_THIN,
    alignment: { horizontal: 'center' },
  });
  setCell(ws, `C${TABLE_HEADER}`, 'Factor F', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    border: BORDER_THIN,
    alignment: { horizontal: 'center' },
  });

  FACTOR_F_TABLE.forEach(([lo, hi, f], i) => {
    const r = TABLE_START + i;
    setCellNumber(ws, `A${r}`, lo, NUMFMT_MONEY, {
      font: FONT_BODY,
      border: BORDER_THIN,
      alignment: { horizontal: 'right' },
    });
    setCellNumber(ws, `B${r}`, hi, NUMFMT_MONEY, {
      font: FONT_BODY,
      border: BORDER_THIN,
      alignment: { horizontal: 'right' },
    });
    setCellNumber(ws, `C${r}`, f, NUMFMT_FACTOR, {
      font: FONT_BODY,
      border: BORDER_THIN,
      alignment: { horizontal: 'center' },
    });
  });

  // ─── ส่วนสูตรคำนวณ (rows 39+) ──────────────────────────────────────────
  const TR = `A${TABLE_START}:A${TABLE_END}`;
  const TRB = `B${TABLE_START}:B${TABLE_END}`;
  const TRC = `C${TABLE_START}:C${TABLE_END}`;

  setCell(
    ws,
    'A40',
    'สูตรคำนวณหาค่า Factor F = D − [(D − E) × (A − B) ÷ (C − B)]',
    { font: FONT_BOLD },
  );

  // A = ค่างานต้นทุน (อ้างจาก ปร.4(ก))
  const aRow = 42;
  setCell(ws, `A${aRow}`, 'A = ค่างานต้นทุน (อ้างจาก ปร.4(ก))', {
    font: FONT_BODY,
  });
  setCellFormula(
    ws,
    `D${aRow}`,
    `'ปร.4(ก)'!${por4.grandTotalCell}`,
    NUMFMT_MONEY,
    {
      font: FONT_BOLD,
      fill: FILL_HIGHLIGHT,
      border: BORDER_THIN,
      alignment: { horizontal: 'right' },
    },
  );

  // B = ค่างานช่วงต่ำ
  const bRow = 43;
  setCell(ws, `A${bRow}`, 'B = ค่างานตัวต่ำกว่าต้นทุน (lower bracket)', {
    font: FONT_BODY,
  });
  setCellFormula(
    ws,
    `D${bRow}`,
    `IFERROR(INDEX(${TR},MATCH(D${aRow},${TR},1)),0)`,
    NUMFMT_MONEY,
    {
      font: FONT_BODY,
      border: BORDER_THIN,
      alignment: { horizontal: 'right' },
    },
  );

  // C = ค่างานช่วงสูง
  const cRow = 44;
  setCell(ws, `A${cRow}`, 'C = ค่างานตัวสูงกว่าต้นทุน (upper bracket)', {
    font: FONT_BODY,
  });
  setCellFormula(
    ws,
    `D${cRow}`,
    `IFERROR(INDEX(${TRB},MATCH(D${aRow},${TR},1)),1)`,
    NUMFMT_MONEY,
    {
      font: FONT_BODY,
      border: BORDER_THIN,
      alignment: { horizontal: 'right' },
    },
  );

  // D = Factor F ช่วงต่ำ
  const dRow = 45;
  setCell(ws, `A${dRow}`, 'D = Factor F ของช่วงต่ำ', { font: FONT_BODY });
  setCellFormula(
    ws,
    `D${dRow}`,
    `IFERROR(INDEX(${TRC},MATCH(D${aRow},${TR},1)),C${TABLE_END})`,
    NUMFMT_FACTOR,
    {
      font: FONT_BODY,
      border: BORDER_THIN,
      alignment: { horizontal: 'center' },
    },
  );

  // E = Factor F ช่วงสูง (= แถวถัดไปของ D; ถ้าเกินใช้ตัวเดียวกัน)
  const eRow = 46;
  setCell(ws, `A${eRow}`, 'E = Factor F ของช่วงสูง', { font: FONT_BODY });
  setCellFormula(
    ws,
    `D${eRow}`,
    `IFERROR(INDEX(${TRC},MATCH(D${aRow},${TR},1)+1),C${TABLE_END})`,
    NUMFMT_FACTOR,
    {
      font: FONT_BODY,
      border: BORDER_THIN,
      alignment: { horizontal: 'center' },
    },
  );

  // Factor F คำนวณ (สงป.)
  const stdRow = 48;
  setCell(ws, `A${stdRow}`, 'Factor F (มาตรฐาน สงป.)', { font: FONT_BOLD });
  setCellFormula(
    ws,
    `D${stdRow}`,
    `IFERROR(D${dRow}-((D${dRow}-D${eRow})*(D${aRow}-D${bRow})/(D${cRow}-D${bRow})),D${dRow})`,
    NUMFMT_FACTOR,
    {
      font: FONT_BOLD,
      fill: FILL_GRAND,
      border: BORDER_THIN,
      alignment: { horizontal: 'center' },
    },
  );

  // Custom Factor F (user input)
  const customRow = 52;
  setCell(
    ws,
    `A${customRow}`,
    '🔧 Factor F ที่ปรับตามเงื่อนไขจริง (กรอกได้, ปล่อย 0 = ใช้มาตรฐาน)',
    { font: FONT_BODY },
  );
  setCellNumber(ws, `D${customRow}`, meta.factorF || 0, NUMFMT_FACTOR, {
    font: FONT_BODY,
    fill: FILL_INPUT,
    border: BORDER_THIN,
    alignment: { horizontal: 'center' },
  });

  // Factor F ที่ใช้จริง (= IF custom > 0 → custom, else standard)
  const finalRow = 53;
  setCell(ws, `A${finalRow}`, 'Factor F ที่จะใช้จริง (เลือก)', {
    font: { ...FONT_BOLD, size: 16 },
  });
  setCellFormula(
    ws,
    `D${finalRow}`,
    `IF(D${customRow}>0,D${customRow},D${stdRow})`,
    NUMFMT_FACTOR,
    {
      font: { ...FONT_BOLD, size: 16 },
      fill: FILL_HIGHLIGHT,
      border: BORDER_DOUBLE_TOP,
      alignment: { horizontal: 'center' },
    },
  );

  return {
    finalFactorCell: `D${finalRow}`,
    advanceCell: `D${advanceRow}`,
    retentionCell: `D${retentionRow}`,
    interestCell: `D${interestRow}`,
    vatCell: `D${vatRow}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Sheet 2: ปร.4(ก) — 12 columns (A-L)
// ═══════════════════════════════════════════════════════════════════════

interface Por4Refs {
  /** cell ของ K{row} ที่เป็นยอดรวมทั้งหมด */
  grandTotalCell: string;
  /** cell ของยอดรวมค่าวัสดุ (H{row}) */
  matSumCell: string;
  /** cell ของยอดรวมค่าแรง (J{row}) */
  laborSumCell: string;
}

function buildPor4(
  ws: ExcelJS.Worksheet,
  opts: GovExportOptions,
): Por4Refs {
  const { items, meta } = opts;
  const sections = groupSections(items);

  // print: A4 landscape (12 cols)
  ws.pageSetup.paperSize = 9;
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.margins = standardMargins();

  ws.columns = [
    { key: 'A', width: 8 }, // ลำดับ
    { key: 'B', width: 28 }, // รายการ (merged B-D)
    { key: 'C', width: 12 },
    { key: 'D', width: 10 },
    { key: 'E', width: 10 }, // จำนวน
    { key: 'F', width: 8 }, // หน่วย
    { key: 'G', width: 14 }, // วัสดุ ราคา/หน่วย
    { key: 'H', width: 14 }, // วัสดุ จำนวนเงิน
    { key: 'I', width: 14 }, // แรง ราคา/หน่วย
    { key: 'J', width: 14 }, // แรง จำนวนเงิน
    { key: 'K', width: 18 }, // รวม
    { key: 'L', width: 16 }, // หมายเหตุ
  ];

  // ─── หัวเอกสาร (rows 1-5) ──────────────────────────────────────────────
  mergeAndSet(ws, 'A1:L1', 'แบบ ปร.4(ก)', {
    font: FONT_TITLE,
    alignment: { horizontal: 'center' },
  });
  mergeAndSet(ws, 'A2:L2', 'รายการปริมาณงานและราคา', {
    font: FONT_SUB,
    alignment: { horizontal: 'center' },
  });
  mergeAndSet(ws, 'A3:L3', meta.name || '[ระบุชื่อโครงการ]', {
    font: FONT_SUB,
    alignment: { horizontal: 'center' },
  });

  mergeAndSet(ws, 'A4:F4', `สถานที่ ${meta.location || '[ระบุ]'}`, {
    font: FONT_BODY,
  });
  mergeAndSet(
    ws,
    'G4:L4',
    `หน่วยงาน ${opts.agency ?? meta.client ?? '[ระบุ]'}`,
    { font: FONT_BODY },
  );

  mergeAndSet(
    ws,
    'A5:F5',
    `ประมาณราคาโดย ${opts.estimatorName ?? '………………………………'} (${opts.estimatorTitle ?? 'ตำแหน่ง'})`,
    { font: FONT_BODY },
  );
  mergeAndSet(
    ws,
    'G5:L5',
    `ประมาณราคาเมื่อวันที่ ${formatThaiDate(new Date())}`,
    { font: FONT_BODY },
  );

  // ─── ตาราง header (rows 7-8) — 2 ระดับ ─────────────────────────────────
  const HDR1 = 7;
  const HDR2 = 8;

  // Level 1
  ws.mergeCells(`A${HDR1}:A${HDR2}`);
  setCell(ws, `A${HDR1}`, 'ลำดับ\nที่', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: BORDER_THIN,
  });

  ws.mergeCells(`B${HDR1}:D${HDR2}`);
  setCell(ws, `B${HDR1}`, 'รายการ', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });

  ws.mergeCells(`E${HDR1}:E${HDR2}`);
  setCell(ws, `E${HDR1}`, 'จำนวน', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });

  ws.mergeCells(`F${HDR1}:F${HDR2}`);
  setCell(ws, `F${HDR1}`, 'หน่วย', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });

  ws.mergeCells(`G${HDR1}:H${HDR1}`);
  setCell(ws, `G${HDR1}`, 'ค่าวัสดุ', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });

  ws.mergeCells(`I${HDR1}:J${HDR1}`);
  setCell(ws, `I${HDR1}`, 'ค่าแรงงาน', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });

  ws.mergeCells(`K${HDR1}:K${HDR2}`);
  setCell(ws, `K${HDR1}`, 'รวมค่าวัสดุ\nและค่าแรงงาน', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: BORDER_THIN,
  });

  ws.mergeCells(`L${HDR1}:L${HDR2}`);
  setCell(ws, `L${HDR1}`, 'หมายเหตุ', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });

  // Level 2 (G-J only)
  setCell(ws, `G${HDR2}`, 'ราคา/หน่วย', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  setCell(ws, `H${HDR2}`, 'จำนวนเงิน', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  setCell(ws, `I${HDR2}`, 'ราคา/หน่วย', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  setCell(ws, `J${HDR2}`, 'จำนวนเงิน', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });

  ws.getRow(HDR1).height = 24;
  ws.getRow(HDR2).height = 22;
  ws.pageSetup.printTitlesRow = `${HDR1}:${HDR2}`;

  // ─── Data rows ─────────────────────────────────────────────────────────
  let cur = HDR2 + 1;
  const firstDataRow = cur;

  if (sections.length === 0) {
    // empty BOQ — แสดง placeholder
    ws.mergeCells(`A${cur}:L${cur}`);
    setCell(
      ws,
      `A${cur}`,
      '(ยังไม่มีรายการ — เพิ่ม BOQ ก่อน export)',
      {
        font: FONT_ITALIC,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: BORDER_THIN,
      },
    );
    cur += 1;
  }

  for (const sec of sections) {
    // section header row
    ws.mergeCells(`B${cur}:D${cur}`);
    setCell(ws, `B${cur}`, `${sec.letter}. ${sec.category}`, {
      font: FONT_BOLD,
      fill: FILL_SECTION,
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: BORDER_THIN,
    });
    // ระบาย fill ทุก column ของ section row
    ['A', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach((col) => {
      const c = ws.getCell(`${col}${cur}`);
      c.fill = FILL_SECTION;
      c.border = BORDER_THIN;
    });
    cur += 1;

    // items
    sec.items.forEach((it, idx) => {
      const qty = adjustedQuantity(it);
      const matUnit = it.isMaterial ? it.unitPrice : 0;
      const labUnit = it.isMaterial ? 0 : it.unitPrice;

      setCell(ws, `A${cur}`, `${sec.letter}${idx + 1}`, {
        font: FONT_BODY,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: BORDER_THIN,
      });

      ws.mergeCells(`B${cur}:D${cur}`);
      setCell(
        ws,
        `B${cur}`,
        it.name + (it.notes ? ` (${it.notes})` : ''),
        {
          font: FONT_BODY,
          alignment: {
            horizontal: 'left',
            vertical: 'middle',
            wrapText: true,
          },
          border: BORDER_THIN,
        },
      );

      setCellNumber(ws, `E${cur}`, qty, '#,##0.00', {
        font: FONT_BODY,
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: BORDER_THIN,
      });

      setCell(ws, `F${cur}`, it.unit, {
        font: FONT_BODY,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: BORDER_THIN,
      });

      setCellNumber(ws, `G${cur}`, matUnit, NUMFMT_MONEY, {
        font: FONT_BODY,
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: BORDER_THIN,
      });
      setCellFormula(ws, `H${cur}`, `E${cur}*G${cur}`, NUMFMT_MONEY, {
        font: FONT_BODY,
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: BORDER_THIN,
      });
      setCellNumber(ws, `I${cur}`, labUnit, NUMFMT_MONEY, {
        font: FONT_BODY,
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: BORDER_THIN,
      });
      setCellFormula(ws, `J${cur}`, `E${cur}*I${cur}`, NUMFMT_MONEY, {
        font: FONT_BODY,
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: BORDER_THIN,
      });
      setCellFormula(ws, `K${cur}`, `H${cur}+J${cur}`, NUMFMT_MONEY, {
        font: FONT_BODY,
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: BORDER_THIN,
      });

      // L blank (or notes column source)
      setCell(ws, `L${cur}`, '', {
        font: FONT_BODY,
        border: BORDER_THIN,
      });

      cur += 1;
    });
  }

  // grand total row (เว้น 1 บรรทัด)
  cur += 1;
  const lastDataRow = cur - 2;
  ws.mergeCells(`A${cur}:F${cur}`);
  setCell(ws, `A${cur}`, 'รวมค่าวัสดุและค่าแรงงานทั้งหมด', {
    font: FONT_BOLD,
    fill: FILL_GRAND,
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: BORDER_DOUBLE_TOP,
  });
  // G: blank
  setCell(ws, `G${cur}`, '', {
    fill: FILL_GRAND,
    border: BORDER_DOUBLE_TOP,
  });
  // H = SUM ค่าวัสดุทั้งหมด
  setCellFormula(
    ws,
    `H${cur}`,
    items.length > 0 ? `SUM(H${firstDataRow}:H${lastDataRow})` : '0',
    NUMFMT_MONEY,
    {
      font: FONT_BOLD,
      fill: FILL_GRAND,
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: BORDER_DOUBLE_TOP,
    },
  );
  // I: blank
  setCell(ws, `I${cur}`, '', {
    fill: FILL_GRAND,
    border: BORDER_DOUBLE_TOP,
  });
  // J = SUM ค่าแรง
  setCellFormula(
    ws,
    `J${cur}`,
    items.length > 0 ? `SUM(J${firstDataRow}:J${lastDataRow})` : '0',
    NUMFMT_MONEY,
    {
      font: FONT_BOLD,
      fill: FILL_GRAND,
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: BORDER_DOUBLE_TOP,
    },
  );
  // K = H + J
  setCellFormula(ws, `K${cur}`, `H${cur}+J${cur}`, NUMFMT_MONEY, {
    font: FONT_BOLD,
    fill: FILL_GRAND,
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: BORDER_DOUBLE_TOP,
  });
  setCell(ws, `L${cur}`, '', {
    fill: FILL_GRAND,
    border: BORDER_DOUBLE_TOP,
  });

  ws.getRow(cur).height = 24;

  return {
    grandTotalCell: `K${cur}`,
    matSumCell: `H${cur}`,
    laborSumCell: `J${cur}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Sheet 3: ปร.5
// ═══════════════════════════════════════════════════════════════════════

interface Por5Refs {
  /** cell ของ "รวมค่าก่อสร้าง" — sheet ปร.6 อ้างมาที่นี่ */
  totalConstructionCell: string;
}

function buildPor5(
  ws: ExcelJS.Worksheet,
  opts: GovExportOptions,
  por4: Por4Refs,
): Por5Refs {
  const { meta } = opts;

  ws.pageSetup.paperSize = 9;
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.margins = standardMargins();

  ws.columns = [
    { key: 'A', width: 8 },
    { key: 'B', width: 24 },
    { key: 'C', width: 16 },
    { key: 'D', width: 14 },
    { key: 'E', width: 14 },
    { key: 'F', width: 14 },
    { key: 'G', width: 16 },
    { key: 'H', width: 16 },
    { key: 'I', width: 18 },
    { key: 'J', width: 12 },
    { key: 'K', width: 20 },
    { key: 'L', width: 18 },
  ];

  mergeAndSet(ws, 'A1:L1', 'แบบ ปร.5(ก)', {
    font: FONT_TITLE,
    alignment: { horizontal: 'center' },
  });
  mergeAndSet(ws, 'A2:L2', 'สรุปราคาค่าก่อสร้าง', {
    font: FONT_SUB,
    alignment: { horizontal: 'center' },
  });
  mergeAndSet(ws, 'A3:L3', meta.name || '[ระบุชื่อโครงการ]', {
    font: FONT_SUB,
    alignment: { horizontal: 'center' },
  });

  mergeAndSet(ws, 'A4:F4', `สถานที่ ${meta.location || '[ระบุ]'}`, {
    font: FONT_BODY,
  });
  mergeAndSet(
    ws,
    'G4:L4',
    `หน่วยงาน ${opts.agency ?? meta.client ?? '[ระบุ]'}`,
    { font: FONT_BODY },
  );

  mergeAndSet(ws, 'A5:F5', 'แบบ ปร.4(ก) ที่แนบ จำนวน 1 แผ่น', {
    font: FONT_BODY,
  });
  mergeAndSet(
    ws,
    'G5:L5',
    `ประมาณราคาเมื่อวันที่ ${formatThaiDate(new Date())}`,
    { font: FONT_BODY },
  );

  // ─── table header (row 7) ──────────────────────────────────────────────
  const HDR = 7;
  setCell(ws, `A${HDR}`, 'ลำดับที่', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  ws.mergeCells(`B${HDR}:G${HDR}`);
  setCell(ws, `B${HDR}`, 'รายการ', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  setCell(ws, `H${HDR}`, '', {
    fill: FILL_HEADER,
    border: BORDER_THIN,
  });
  setCell(ws, `I${HDR}`, 'ค่างานต้นทุน\n(บาท)', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: BORDER_THIN,
  });
  setCell(ws, `J${HDR}`, 'Factor F', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  setCell(ws, `K${HDR}`, 'ค่าก่อสร้าง\n(บาท)', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: BORDER_THIN,
  });
  setCell(ws, `L${HDR}`, 'หมายเหตุ', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  ws.getRow(HDR).height = 26;
  ws.pageSetup.printTitlesRow = `${HDR}:${HDR}`;

  // ─── Data ──────────────────────────────────────────────────────────────
  // Row 8: ค่าก่อสร้างหลัก
  const mainRow = 8;
  setCell(ws, `A${mainRow}`, '1', {
    font: FONT_BODY,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  ws.mergeCells(`B${mainRow}:G${mainRow}`);
  setCell(
    ws,
    `B${mainRow}`,
    `ค่าก่อสร้าง ${meta.name || '[ระบุชื่อโครงการ]'}`,
    {
      font: FONT_BODY,
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      border: BORDER_THIN,
    },
  );
  setCell(ws, `H${mainRow}`, '', { border: BORDER_THIN });
  setCellFormula(
    ws,
    `I${mainRow}`,
    `'ปร.4(ก)'!${por4.grandTotalCell}`,
    NUMFMT_MONEY,
    {
      font: FONT_BODY,
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: BORDER_THIN,
    },
  );
  setCellFormula(ws, `J${mainRow}`, `'Factor F'!D53`, NUMFMT_FACTOR, {
    font: FONT_BODY,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  setCellFormula(ws, `K${mainRow}`, `I${mainRow}*J${mainRow}`, NUMFMT_MONEY, {
    font: FONT_BODY,
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: BORDER_THIN,
  });
  setCell(ws, `L${mainRow}`, '', { border: BORDER_THIN });

  // Row 10: เงื่อนไข
  setCell(ws, 'A10', 'เงื่อนไข', { font: FONT_BOLD });

  // Row 11-14: components
  const condRows: Array<[string, string]> = [
    ['เงินล่วงหน้าจ่าย', `'Factor F'!D7`],
    ['เงินประกันผลงานหัก', `'Factor F'!D8`],
    ['ดอกเบี้ยเงินกู้', `'Factor F'!D9`],
    ['ค่าภาษีมูลค่าเพิ่ม (VAT)', `'Factor F'!D10`],
  ];
  condRows.forEach(([label, formula], i) => {
    const r = 11 + i;
    setCell(ws, `A${r}`, `${i + 1}`, {
      font: FONT_BODY,
      alignment: { horizontal: 'center' },
      border: BORDER_THIN,
    });
    ws.mergeCells(`B${r}:J${r}`);
    setCell(ws, `B${r}`, label, {
      font: FONT_BODY,
      alignment: { horizontal: 'left' },
      border: BORDER_THIN,
    });
    setCellFormula(ws, `K${r}`, formula, NUMFMT_PCT, {
      font: FONT_BODY,
      alignment: { horizontal: 'right' },
      border: BORDER_THIN,
    });
    setCell(ws, `L${r}`, '', { border: BORDER_THIN });
  });

  // Row 16: รวมค่าก่อสร้าง
  const totalRow = 16;
  ws.mergeCells(`A${totalRow}:J${totalRow}`);
  setCell(ws, `A${totalRow}`, 'รวมค่าก่อสร้าง', {
    font: FONT_BOLD,
    fill: FILL_GRAND,
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: BORDER_DOUBLE_TOP,
  });
  setCellFormula(ws, `K${totalRow}`, `K${mainRow}`, NUMFMT_MONEY, {
    font: { ...FONT_BOLD, size: 16 },
    fill: FILL_GRAND,
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: BORDER_DOUBLE_TOP,
  });
  setCell(ws, `L${totalRow}`, '', {
    fill: FILL_GRAND,
    border: BORDER_DOUBLE_TOP,
  });
  ws.getRow(totalRow).height = 26;

  // Row 17: ยอดสุทธิ (ราคาเสนอ)
  const netRow = 17;
  ws.mergeCells(`A${netRow}:J${netRow}`);
  setCell(ws, `A${netRow}`, 'ยอดสุทธิ (ราคาเสนอ)', {
    font: FONT_BOLD,
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: BORDER_THIN,
  });
  setCellFormula(ws, `K${netRow}`, `K${totalRow}`, NUMFMT_MONEY, {
    font: FONT_BOLD,
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: BORDER_THIN,
  });
  setCell(ws, `L${netRow}`, '', { border: BORDER_THIN });

  // ─── ส่วนเปรียบเทียบงบ (optional) ─────────────────────────────────────
  let cur = netRow + 2;
  if (opts.budget != null) {
    mergeAndSet(ws, `B${cur}:J${cur}`, 'งบประมาณเป้า (net construction budget)', {
      font: FONT_BODY,
      border: BORDER_THIN,
    });
    setCellNumber(ws, `K${cur}`, opts.budget, NUMFMT_MONEY, {
      font: FONT_BODY,
      alignment: { horizontal: 'right' },
      border: BORDER_THIN,
    });
    cur += 1;

    mergeAndSet(ws, `B${cur}:J${cur}`, 'ค่างานต้นทุน vs งบ (net comparison)', {
      font: FONT_BODY,
      border: BORDER_THIN,
    });
    setCellFormula(ws, `K${cur}`, `I${mainRow}-K${cur - 1}`, NUMFMT_MONEY, {
      font: FONT_BODY,
      alignment: { horizontal: 'right' },
      border: BORDER_THIN,
    });
    cur += 1;

    mergeAndSet(ws, `B${cur}:J${cur}`, 'ผลลัพธ์ (net)', {
      font: FONT_BODY,
      border: BORDER_THIN,
    });
    setCellFormula(
      ws,
      `K${cur}`,
      `IF(I${mainRow}<K${cur - 2},"✓ ต่ำกว่างบ","✗ สูงกว่างบ")`,
      undefined,
      {
        font: FONT_BOLD,
        alignment: { horizontal: 'center' },
        border: BORDER_THIN,
      },
    );
    cur += 1;
  }

  // ─── ลายเซ็น ──────────────────────────────────────────────────────────
  cur += 2;
  const signA = cur;
  setCell(ws, `A${signA}`, 'ผู้ประมาณราคา', { font: FONT_BODY });
  mergeAndSet(ws, `C${signA}:F${signA}`, '………………………………………………………', {
    font: FONT_BODY,
    alignment: { horizontal: 'center' },
  });
  mergeAndSet(
    ws,
    `G${signA}:L${signA}`,
    `ตำแหน่ง ${opts.estimatorTitle ?? '……………………………'}`,
    { font: FONT_BODY },
  );
  cur += 1;
  mergeAndSet(
    ws,
    `C${cur}:F${cur}`,
    `(${opts.estimatorName ?? '……………………………'})`,
    { font: FONT_BODY, alignment: { horizontal: 'center' } },
  );
  cur += 2;

  setCell(ws, `A${cur}`, 'รับรองความถูกต้อง', { font: FONT_BODY });
  mergeAndSet(ws, `C${cur}:F${cur}`, '………………………………………………………', {
    font: FONT_BODY,
    alignment: { horizontal: 'center' },
  });
  mergeAndSet(
    ws,
    `G${cur}:L${cur}`,
    opts.reviewerTitle ?? '[ตำแหน่งผู้รับรอง]',
    { font: FONT_BODY },
  );
  cur += 1;
  mergeAndSet(ws, `C${cur}:F${cur}`, '(……………………………)', {
    font: FONT_BODY,
    alignment: { horizontal: 'center' },
  });

  return { totalConstructionCell: `K${totalRow}` };
}

// ═══════════════════════════════════════════════════════════════════════
// Sheet 4: ปร.6
// ═══════════════════════════════════════════════════════════════════════

function buildPor6(
  ws: ExcelJS.Worksheet,
  opts: GovExportOptions,
  por5: Por5Refs,
): void {
  const { meta } = opts;

  ws.pageSetup.paperSize = 9;
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.margins = standardMargins();

  ws.columns = [
    { key: 'A', width: 8 },
    { key: 'B', width: 24 },
    { key: 'C', width: 20 },
    { key: 'D', width: 14 },
    { key: 'E', width: 14 },
    { key: 'F', width: 16 },
    { key: 'G', width: 16 },
    { key: 'H', width: 18 },
    { key: 'I', width: 16 },
    { key: 'J', width: 20 },
  ];

  mergeAndSet(ws, 'A1:J1', 'แบบ ปร.6', {
    font: FONT_TITLE,
    alignment: { horizontal: 'center' },
  });
  mergeAndSet(ws, 'A2:J2', 'สรุปราคาค่าก่อสร้าง', {
    font: FONT_SUB,
    alignment: { horizontal: 'center' },
  });
  mergeAndSet(ws, 'A3:J3', meta.name || '[ระบุชื่อโครงการ]', {
    font: FONT_SUB,
    alignment: { horizontal: 'center' },
  });

  mergeAndSet(ws, 'A4:E4', `สถานที่ ${meta.location || '[ระบุ]'}`, {
    font: FONT_BODY,
  });
  mergeAndSet(
    ws,
    'F4:J4',
    `หน่วยงาน ${opts.agency ?? meta.client ?? '[ระบุ]'}`,
    { font: FONT_BODY },
  );

  mergeAndSet(
    ws,
    'A5:E5',
    'แบบ ปร.4(ก) ปร.5(ก) ปร.6 และ Factor F ที่แนบ จำนวน 4 แผ่น',
    { font: FONT_BODY },
  );
  mergeAndSet(
    ws,
    'F5:J5',
    `ประมาณราคาเมื่อวันที่ ${formatThaiDate(new Date())}`,
    { font: FONT_BODY },
  );

  // ─── table header (row 7) ──────────────────────────────────────────────
  const HDR = 7;
  setCell(ws, `A${HDR}`, 'ลำดับที่', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  ws.mergeCells(`B${HDR}:F${HDR}`);
  setCell(ws, `B${HDR}`, 'รายการ', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  setCell(ws, `G${HDR}`, '', { fill: FILL_HEADER, border: BORDER_THIN });
  ws.mergeCells(`H${HDR}:I${HDR}`);
  setCell(ws, `H${HDR}`, 'ค่าก่อสร้าง (บาท)', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  setCell(ws, `J${HDR}`, 'หมายเหตุ', {
    font: FONT_BOLD,
    fill: FILL_HEADER,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  ws.getRow(HDR).height = 24;
  ws.pageSetup.printTitlesRow = `${HDR}:${HDR}`;

  // ─── Row 8: "สรุป" sub-header ─────────────────────────────────────────
  ws.mergeCells('A8:J8');
  setCell(ws, 'A8', 'สรุป', {
    font: FONT_BOLD,
    alignment: { horizontal: 'left', vertical: 'middle' },
    border: BORDER_THIN,
  });

  // ─── Row 9: ค่าก่อสร้างหลัก ───────────────────────────────────────────
  const dataRow = 9;
  setCell(ws, `A${dataRow}`, '1', {
    font: FONT_BODY,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  ws.mergeCells(`B${dataRow}:F${dataRow}`);
  setCell(
    ws,
    `B${dataRow}`,
    `ค่าก่อสร้าง ${meta.name || '[ระบุชื่อโครงการ]'}`,
    {
      font: FONT_BODY,
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      border: BORDER_THIN,
    },
  );
  setCell(ws, `G${dataRow}`, '', { border: BORDER_THIN });
  ws.mergeCells(`H${dataRow}:I${dataRow}`);
  setCellFormula(
    ws,
    `H${dataRow}`,
    `'ปร.5'!${por5.totalConstructionCell}`,
    NUMFMT_MONEY,
    {
      font: FONT_BODY,
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: BORDER_THIN,
    },
  );
  setCell(ws, `J${dataRow}`, '', { border: BORDER_THIN });

  // ─── Row 11: รวมค่าก่อสร้างทั้งสิ้น ──────────────────────────────────
  const totalRow = 11;
  ws.mergeCells(`A${totalRow}:G${totalRow}`);
  setCell(ws, `A${totalRow}`, 'รวมค่าก่อสร้างเป็นเงินทั้งสิ้น', {
    font: { ...FONT_BOLD, size: 16 },
    fill: FILL_GRAND,
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: BORDER_DOUBLE_TOP,
  });
  ws.mergeCells(`H${totalRow}:I${totalRow}`);
  setCellFormula(ws, `H${totalRow}`, `H${dataRow}`, NUMFMT_MONEY, {
    font: { ...FONT_BOLD, size: 16 },
    fill: FILL_GRAND,
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: BORDER_DOUBLE_TOP,
  });
  setCell(ws, `J${totalRow}`, '**', {
    font: FONT_BOLD,
    fill: FILL_GRAND,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_DOUBLE_TOP,
  });
  ws.getRow(totalRow).height = 30;

  // ─── Row 12: bahtText ──────────────────────────────────────────────────
  const directCost =
    opts.items.reduce(
      (sum, it) => sum + adjustedQuantity(it) * it.unitPrice,
      0,
    ) * (meta.factorF || 1);
  const bahtRow = 12;
  ws.mergeCells(`A${bahtRow}:J${bahtRow}`);
  setCell(ws, `A${bahtRow}`, `(${bahtText(directCost)})`, {
    font: { ...FONT_ITALIC, size: 14 },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: BORDER_THIN,
  });
  ws.getRow(bahtRow).height = 24;

  // ─── ลายเซ็น (rows 14+) ────────────────────────────────────────────────
  let cur = 14;
  setCell(ws, `A${cur}`, 'ผู้ประมาณราคา', { font: FONT_BODY });
  mergeAndSet(ws, `C${cur}:E${cur}`, '………………………………………………………', {
    font: FONT_BODY,
    alignment: { horizontal: 'center' },
  });
  mergeAndSet(
    ws,
    `G${cur}:J${cur}`,
    `ตำแหน่ง ${opts.estimatorTitle ?? '……………………………'}`,
    { font: FONT_BODY },
  );
  cur += 1;
  mergeAndSet(
    ws,
    `C${cur}:E${cur}`,
    `(${opts.estimatorName ?? '……………………………'})`,
    { font: FONT_BODY, alignment: { horizontal: 'center' } },
  );
  cur += 2;

  setCell(ws, `A${cur}`, 'รับรองความถูกต้อง', { font: FONT_BODY });
  mergeAndSet(ws, `C${cur}:E${cur}`, '………………………………………………………', {
    font: FONT_BODY,
    alignment: { horizontal: 'center' },
  });
  mergeAndSet(
    ws,
    `G${cur}:J${cur}`,
    opts.reviewerTitle ?? '[ตำแหน่งผู้รับรอง]',
    { font: FONT_BODY },
  );
  cur += 1;
  mergeAndSet(ws, `C${cur}:E${cur}`, '(……………………………)', {
    font: FONT_BODY,
    alignment: { horizontal: 'center' },
  });
  cur += 2;

  setCell(ws, `A${cur}`, 'ตรวจสอบความถูกต้อง', { font: FONT_BODY });
  mergeAndSet(ws, `C${cur}:E${cur}`, '………………………………………………………', {
    font: FONT_BODY,
    alignment: { horizontal: 'center' },
  });
  mergeAndSet(
    ws,
    `G${cur}:J${cur}`,
    opts.inspectorTitle ?? '[ตำแหน่งผู้ตรวจสอบ]',
    { font: FONT_BODY },
  );
  cur += 1;
  mergeAndSet(ws, `C${cur}:E${cur}`, '(……………………………)', {
    font: FONT_BODY,
    alignment: { horizontal: 'center' },
  });
  cur += 3;

  // ─── หมายเหตุท้าย ─────────────────────────────────────────────────────
  mergeAndSet(
    ws,
    `A${cur}:J${cur}`,
    'หมายเหตุ: หากเปลี่ยน Factor F → ตัวเลขใน ปร.5 และ ปร.6 จะอัปเดตอัตโนมัติ ' +
      'แต่ตัวอักษรจำนวนเงิน (บาทถ้วน) ต้อง re-export จาก app',
    {
      font: { ...FONT_ITALIC, color: { argb: 'FF595959' } },
      alignment: { wrapText: true },
    },
  );
}

// ═══════════════════════════════════════════════════════════════════════
// helpers
// ═══════════════════════════════════════════════════════════════════════

interface CellStyle {
  font?: Partial<ExcelJS.Font>;
  fill?: ExcelJS.FillPattern;
  alignment?: Partial<ExcelJS.Alignment>;
  border?: Partial<ExcelJS.Borders>;
}

function setCell(
  ws: ExcelJS.Worksheet,
  addr: string,
  value: string | number,
  style: CellStyle = {},
): void {
  const cell = ws.getCell(addr);
  cell.value = value;
  applyStyle(cell, style);
}

function setCellNumber(
  ws: ExcelJS.Worksheet,
  addr: string,
  value: number,
  numFmt: string | undefined,
  style: CellStyle = {},
): void {
  const cell = ws.getCell(addr);
  cell.value = value;
  if (numFmt) cell.numFmt = numFmt;
  applyStyle(cell, style);
}

function setCellFormula(
  ws: ExcelJS.Worksheet,
  addr: string,
  formula: string,
  numFmt: string | undefined,
  style: CellStyle = {},
): void {
  const cell = ws.getCell(addr);
  cell.value = { formula } as ExcelJS.CellFormulaValue;
  if (numFmt) cell.numFmt = numFmt;
  applyStyle(cell, style);
}

function applyStyle(cell: ExcelJS.Cell, style: CellStyle): void {
  if (style.font) cell.font = style.font;
  if (style.fill) cell.fill = style.fill;
  if (style.alignment) cell.alignment = style.alignment;
  if (style.border) cell.border = style.border;
}

function mergeAndSet(
  ws: ExcelJS.Worksheet,
  range: string,
  value: string,
  style: CellStyle = {},
): void {
  ws.mergeCells(range);
  const firstAddr = range.split(':')[0]!;
  setCell(ws, firstAddr, value, style);
}

function formatThaiDate(d: Date): string {
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function standardMargins() {
  return {
    left: 0.4,
    right: 0.4,
    top: 0.5,
    bottom: 0.5,
    header: 0.3,
    footer: 0.3,
  };
}

function defaultFileName(meta: ProjectMeta, mode: GovExportMode): string {
  const safe = (meta.name || 'โปรเจกต์').replace(/[\\/:*?"<>|]/g, '_');
  const date = new Date().toISOString().slice(0, 10);
  const prefix = mode === 'por4' ? 'ปร.4(ก)' : 'ปร456';
  return `${prefix}_${safe}_${date}.xlsx`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
