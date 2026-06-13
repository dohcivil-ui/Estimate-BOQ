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
 * round 4 ตำแหน่งทศนิยมหลัง interpolate — มาตรฐาน ปร.5 ราชการเก็บ F = 4dp
 * หลักฐาน 2 ชุดอิสระ:
 *   ข) สพฐ. ห้องสมุด: 2,335,640 บาท → 1.3051−(0.0031×335,640/3M) = 1.304753... → 1.3048
 *      พิสูจน์ 2,335,640 × 1.3048 = 3,047,543.072 ✓
 *   ก) ตัวอย่างอื่น (สพฐ. รายงาน 1.2612 จากตารางคนละชุด): ระบบนี้ใช้ CGD 2567
 *      ⇒ 14,489,053.08 บาท → 1.2960+0.8978×(1.2611−1.2960) = 1.264666... → 1.2647
 *
 * คืนค่าเดียวกับ sheet "Factor F" ใน gov export เพื่อให้ตัวเลขในแอปตรงกับตาราง
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
  return Math.round(f * 10000) / 10000;
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
