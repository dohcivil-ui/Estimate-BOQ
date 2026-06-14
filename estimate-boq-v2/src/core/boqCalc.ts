/**
 * PURE: คำนวณ amount/totals ของ BOQ
 * ห้าม import React/Konva
 */
import type { BOQItem } from '@/types/boq';
import { lookupFactorF, factorFBracket } from '@/data/factorF-CGD-2567';

// ค่าที่ตาราง CGD 2567 รองรับ (snap ค่าที่เลือกเข้าหาค่าที่ถูกต้อง)
const VALID_ADVANCE = [0, 5, 10, 15];
const VALID_RETENTION = [0, 5, 10];
const snapTo = (valid: number[], v: number): number =>
  valid.reduce((best, c) => (Math.abs(c - v) < Math.abs(best - v) ? c : best), valid[0]!);

/**
 * Factor F ที่ใช้จริง:
 *   - override > 0 → ใช้ค่าที่กรอกเอง
 *   - มิฉะนั้น → lookup จากตาราง CGD 2567 ตามค่างาน (บาท) + เงินล่วงหน้า/เงินประกัน
 *
 * ceil (ปัดขึ้น) 4 ตำแหน่งทศนิยมหลัง interpolate — ตรงกับ master CGD (CEILING(.,0.0001))
 * และ PDF ราชการ → ค่า F ในแอป (จอ ปร.5) ตรงกับไฟล์ Excel ที่ export เป๊ะ
 * (เดิมใช้ round → ต่ำกว่า 1 หลักในบางช่วง เช่น 9,646,704.50 → round 1.2964 vs ceil 1.2965
 *  ทำให้ ปร.5/ปร.6 ต่างจาก export 1,000 บาท — ยืนยัน ceil โดยตาราง CGD + govExcelVerify)
 * หลักฐาน 2 ชุดอิสระ (round กับ ceil ให้ค่าเท่ากันทั้งคู่ → ไม่กระทบ seed):
 *   ข) สพฐ. ห้องสมุด: 2,335,640 บาท → 1.304753... → 1.3048
 *      พิสูจน์ 2,335,640 × 1.3048 = 3,047,543.072 ✓
 *   ก) 14,489,053.08 บาท → 1.264666... → 1.2647 (CGD 2567)
 *
 * คืนค่าเดียวกับ sheet "Factor F" ใน gov export เพื่อให้ตัวเลขในแอปตรงกับตาราง
 * (epsilon -1e-7 กัน float: exact bracket 1.3020 ที่ ×1e4 ได้ 13020.0000…2 ไม่ถูกปัดขึ้นผิดเป็น 1.3021)
 */
export function effectiveFactorF(
  directCost: number,
  override: number,
  advancePct: number,
  retentionPct: number,
): number {
  if (override > 0 && isFinite(override)) return override;
  const f = lookupFactorF(
    directCost / 1_000_000,
    snapTo(VALID_ADVANCE, advancePct),
    snapTo(VALID_RETENTION, retentionPct),
  );
  if (f == null) return 1;
  return Math.ceil(f * 10000 - 1e-7) / 10000;
}

export interface FactorFBracketInput {
  advanceRate: number;   // เศษส่วน (0.05)
  retentionRate: number; // เศษส่วน
  rangeLow: number;      // บาท
  rangeHigh: number;     // บาท
  fLow: number;
  fHigh: number;
}

/**
 * bracket Factor F สำหรับป้อน master ให้ interpolate เอง → ตรง effectiveFactorF (double-entry)
 * snap advance/retention เหมือน effectiveFactorF · rate=เศษส่วน, ค่างาน=บาท
 */
export function factorFBracketFor(
  directCost: number,
  advancePct: number,
  retentionPct: number,
): FactorFBracketInput | null {
  const adv = snapTo(VALID_ADVANCE, advancePct);
  const ret = snapTo(VALID_RETENTION, retentionPct);
  const r = factorFBracket(directCost / 1_000_000, adv, ret);
  if (!r) return null;
  return {
    advanceRate: adv / 100,
    retentionRate: ret / 100,
    rangeLow: r.rangeLowM * 1_000_000,
    rangeHigh: r.rangeHighM * 1_000_000,
    fLow: r.fLow,
    fHigh: r.fHigh,
  };
}

/**
 * adjusted quantity (เผื่อเสีย):
 *   qty × (1 + waste/100)
 *
 * ถ้ามี thickness (เช่น slab area → volume) → qty × thickness × (1 + waste/100)
 */
export function adjustedQuantity(item: BOQItem): number {
  const base = item.thickness != null ? item.quantity * item.thickness : item.quantity;
  return base * (1 + (item.wastePct || 0) / 100);
}

/** amount ของ 1 row = adjustedQty × unitPrice */
export function rowAmount(item: BOQItem): number {
  return adjustedQuantity(item) * item.unitPrice;
}

/** รวม direct cost (ก่อน Factor F) */
export function directCostTotal(items: BOQItem[]): number {
  return items.reduce((sum, it) => sum + rowAmount(it), 0);
}

/** แยก subtotal: labor vs material */
export function totalsByKind(items: BOQItem[]): {
  labor: number;
  material: number;
  total: number;
} {
  let labor = 0;
  let material = 0;
  for (const it of items) {
    const a = rowAmount(it);
    if (it.isMaterial) material += a;
    else labor += a;
  }
  return { labor, material, total: labor + material };
}

/** market price = directCost × factorF */
export function marketPrice(directCost: number, factorF: number): number {
  if (!isFinite(factorF) || factorF <= 0) return directCost;
  return directCost * factorF;
}

/** format ตัวเลขเป็นข้อความไทย "1,234.56" */
export function formatCurrency(n: number, fraction = 2): string {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  });
}
