/**
 * govExcelVerify.ts — Tier 1: ตรวจ input ก่อนยัดลง master (pure TS, ไม่อ่านไฟล์ Excel)
 * ─────────────────────────────────────────────────────────────────────────
 * หลักการ "double-entry": คำนวณ chain (ปร.4→Factor F→ปร.5→ปร.6) ขึ้นมาใหม่ "อิสระ"
 * จาก logic layer แล้วคืน `expect` ให้ Tier 2 เอาไปเทียบกับค่าที่ Excel recalc ได้จริง
 * — ถ้าทั้งสองฝั่งพึ่ง function เดียวกัน บั๊กใน function นั้นจะรอดทั้งคู่ จึงคำนวณแยก
 *
 * พิสูจน์แล้วกับเอกสารราชการจริง (อาคารเรียน 324 ล./55-ข): por6 = 13,938,000 ตรงเป๊ะ
 *
 * ⚠️ ทิศปัด Factor F: PDF ราชการใช้ "ปัดขึ้น (ceil 4dp)" → ค่า default = 'ceil'
 *    master ปัจจุบันใช้ FLOOR(N26) ซึ่งให้ค่าต่ำกว่า 1 หลัก — รอยืนยัน CGD primary source
 *    verifier คืนทั้ง factorFFloor/factorFCeil ให้เทียบได้ทั้งสองทาง
 * ─────────────────────────────────────────────────────────────────────────
 */
import { BUILDING, EQUIPMENT } from './govExcelMap';
import type { BoqExportData, SectionRow } from './govExcelExport';

export type IssueLevel = 'error' | 'warn';
export interface VerifyIssue { level: IssueLevel; code: string; where: string; msg: string; }

export interface ChainExpect {
  buildingNet: number;   // ค่างานต้นทุนอาคาร = Σ(วัสดุ+แรง) ทุกหมวด = 1.ปร.4!F18
  factorFRaw: number;    // ผล interpolate ดิบ (ก่อนปัด)
  factorFFloor: number;  // ปัดลง 4dp (= ที่ master N26 ทำตอนนี้)
  factorFCeil: number;   // ปัดขึ้น 4dp (= ที่ PDF ราชการใช้)
  por5kGross: number;    // buildingNet × Factor F (ตาม rule ที่เลือก)
  por5kNet: number;      // ปัด floor ตาม roundStep (ยอดสุทธิ ปร.5ก)
  equipNet: number;      // ครุภัณฑ์ Σ(วัสดุ+แรง)
  por5khGross: number;   // equipNet × (1+VAT)  ไม่ผ่าน Factor F
  por5khNet: number;     // ปัด floor (ยอดสุทธิ ปร.5ข)
  special3: number;      // ส่วนที่ 3 (ยังไม่รับ input → 0)
  discount: number;      // ส่วนลด (ยังไม่รับ input → 0)
  por6Total: number;     // por5kNet + por5khNet + special3 − discount
}

export interface VerifyResult { ok: boolean; issues: VerifyIssue[]; expect: ChainExpect; }

export interface VerifyOptions {
  factorFRule?: 'floor' | 'ceil'; // default 'ceil' (ตาม PDF ราชการ)
  roundStep?: number;             // default 1000 (ยอดสุทธิ ปัด floor-พัน ทั้ง ปร.5ก/ข ตาม PDF)
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const floorStep = (n: number, step: number) => Math.floor(n / step) * step;
const floor4 = (n: number) => Math.floor(n * 1e4) / 1e4;
const ceil4 = (n: number) => Math.ceil(n * 1e4 - 1e-9) / 1e4;

function sectionNet(rows: SectionRow[]): { mat: number; labor: number } {
  let mat = 0, labor = 0;
  for (const row of rows) {
    if (row.type !== 'item') continue;
    mat = r2(mat + r2(row.qty * row.matUnit));
    labor = r2(labor + r2(row.qty * row.laborUnit));
  }
  return { mat, labor };
}

function checkItems(rows: SectionRow[], where: string, issues: VerifyIssue[]): void {
  rows.forEach((row, i) => {
    if (row.type !== 'item') return;
    const at = `${where} แถวที่ ${i + 1} "${row.name}"`;
    for (const [k, v] of [['qty', row.qty], ['matUnit', row.matUnit], ['laborUnit', row.laborUnit]] as const) {
      if (!Number.isFinite(v)) issues.push({ level: 'error', code: 'BAD_NUMBER', where: at, msg: `${k}=${v}` });
      else if (v < 0) issues.push({ level: 'error', code: 'NEGATIVE', where: at, msg: `${k}=${v}` });
    }
  });
}

/** ตรวจ input ของ BoqExportData ก่อน export + คืน chain ที่คาดหวัง */
export function verifyBoqInput(data: BoqExportData, opts: VerifyOptions = {}): VerifyResult {
  const rule = opts.factorFRule ?? 'ceil';
  const step = opts.roundStep ?? 1000;
  const issues: VerifyIssue[] = [];

  // ── อาคาร: sanity + slot fit + convention ต่อหมวด ──
  let buildMat = 0, buildLabor = 0;
  for (const s of BUILDING.sections) {
    const rows = data.buildingItems[s.code] ?? [];
    const where = `หมวด ${s.code} ${s.name}`;
    const slots = s.lastItem - s.firstItem + 1;
    if (rows.length > slots)
      issues.push({ level: 'error', code: 'SLOT_OVERFLOW', where, msg: `${rows.length} แถว เกิน slot ${slots}` });
    checkItems(rows, where, issues);
    // convention: slot แรกควรเป็น 'sub' — master รวมค่าแรง/รวมเริ่มแถวถัดไป ถ้าตัวแรกเป็น item มีราคาจะหาย
    if (rows.length && rows[0].type === 'item' && (rows[0].matUnit || rows[0].laborUnit))
      issues.push({ level: 'warn', code: 'FIRST_SLOT_ITEM', where, msg: 'รายการแรกเป็น item ที่มีราคา — เสี่ยงยอดแรง/รวมตกแถวแรกใน master' });
    const net = sectionNet(rows);
    buildMat = r2(buildMat + net.mat);
    buildLabor = r2(buildLabor + net.labor);
  }
  const buildingNet = r2(buildMat + buildLabor);

  // ── ครุภัณฑ์ ──
  const eqSlots = EQUIPMENT.lastItem - EQUIPMENT.firstItem + 1;
  if (data.equipmentItems.length > eqSlots)
    issues.push({ level: 'error', code: 'SLOT_OVERFLOW', where: 'ครุภัณฑ์', msg: `${data.equipmentItems.length} แถว เกิน slot ${eqSlots}` });
  checkItems(data.equipmentItems, 'ครุภัณฑ์', issues);
  const eqNet = sectionNet(data.equipmentItems);
  const equipNet = r2(eqNet.mat + eqNet.labor);

  // ── Factor F: ช่วงต้องครอบค่างานต้นทุน (FLAG 2 — กัน extrapolate) ──
  const f = data.factorF;
  if (!(f.rangeLow < f.rangeHigh))
    issues.push({ level: 'error', code: 'FACTORF_RANGE', where: 'factorF', msg: `rangeLow ${f.rangeLow} ต้อง < rangeHigh ${f.rangeHigh}` });
  // flat clamp (ว.499: ≤0.5M หรือ >500M): fLow===fHigh → สูตร master ให้ค่าคงที่ extrapolate ไม่ได้ จึงข้าม guard
  // (กัน false-positive ตอนต้นทุน <500k ที่ bracket rangeLow ถูก snap เป็น 500,000)
  const isFlatClamp = f.fLow === f.fHigh;
  if (!isFlatClamp && (buildingNet < f.rangeLow || buildingNet > f.rangeHigh))
    issues.push({ level: 'error', code: 'FACTORF_BRACKET', where: 'factorF', msg: `ค่างานต้นทุน ${buildingNet.toLocaleString()} อยู่นอกช่วง [${f.rangeLow.toLocaleString()}, ${f.rangeHigh.toLocaleString()}] → interpolate กลายเป็น extrapolate` });

  // interpolate ตรงสูตร master: D − ((D−E)(A−B))/(C−B)
  const span = f.rangeHigh - f.rangeLow;
  const factorFRaw = span ? f.fLow - ((f.fLow - f.fHigh) * (buildingNet - f.rangeLow)) / span : f.fLow;
  const factorFFloor = floor4(factorFRaw);
  const factorFCeil = ceil4(factorFRaw);
  const factorF = rule === 'ceil' ? factorFCeil : factorFFloor;

  // ── chain ──
  const vat = data.conditions?.vat ?? 0.07;
  const eqVat = data.conditions?.equipmentVat ?? vat;
  const por5kGross = r2(buildingNet * factorF);
  const por5kNet = floorStep(por5kGross, step);
  const por5khGross = r2(equipNet * (1 + eqVat));
  const por5khNet = floorStep(por5khGross, step);
  const special3 = 0;
  const discount = 0;
  const por6Total = por5kNet + por5khNet + special3 - discount;

  const expect: ChainExpect = {
    buildingNet, factorFRaw, factorFFloor, factorFCeil,
    por5kGross, por5kNet, equipNet, por5khGross, por5khNet,
    special3, discount, por6Total,
  };
  return { ok: !issues.some(i => i.level === 'error'), issues, expect };
}

/** Tier 2 ใช้: เทียบ expect (TS) กับค่าที่ recalc ได้จริงจากไฟล์ ภายใน tolerance (satang) */
export function compareChain(
  expect: ChainExpect,
  actual: Partial<Record<keyof ChainExpect, number>>,
  tol = 0.01,
): VerifyIssue[] {
  const issues: VerifyIssue[] = [];
  for (const k of Object.keys(actual) as (keyof ChainExpect)[]) {
    const a = actual[k]; const e = expect[k];
    if (a === undefined || e === undefined) continue;
    if (Math.abs(a - e) > tol)
      issues.push({ level: 'error', code: 'CHAIN_MISMATCH', where: k, msg: `คาด ${e} แต่ไฟล์ให้ ${a} (ต่าง ${r2(a - e)})` });
  }
  return issues;
}
