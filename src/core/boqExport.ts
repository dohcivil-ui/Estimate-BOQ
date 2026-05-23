// src/core/boqExport.ts — PURE Thai BOQ form roll-up (ปร.4/5ก/5ข/6) — Layer 1
//
// SCOPE: roll-up เท่านั้น. ไม่มี xlsx writer/template (= Layer 2 ภายหลัง).
// ห้าม import React/Konva. ห้ามแตะ formula.ts/factorF.ts (import เท่านั้น).
//
// SOURCE-OF-TRUTH: engine = canonical ; spreadsheet = sink.
//   ผลที่ออกจาก ปร.4/5ก/5ข/6 ต้อง derive ได้จาก PricedLine[] + ProjectFactorParams เสมอ
//   ห้ามแก้สเปรดชีตแล้ว reverse-engineer กลับมาเข้า engine.

import { lookupFactorF } from './factorF';

// =============================================================================
// Rounding utilities — float-robust ceil/floor
//
// IEEE noise (เช่น 0.1*0.2 = 0.020000000000000004) ห้ามดันค่าผิดทาง:
//   - ceilSatang: ดันขึ้นเฉพาะเศษ "จริง" (ไม่ใช่ ULP noise)
//   - roundRatchaklang: ตัดสตางค์ทิ้ง แต่ X.00 ที่มี noise ใต้ (X.999999...) ต้องไม่ตก X-1
//
// เทคนิค: pre-round ที่ความละเอียดสูงกว่า (แต่ภายใน MAX_SAFE_INTEGER) เพื่อ absorb
// ULP noise ก่อนเรียก Math.ceil/floor.
// =============================================================================

/**
 * ceilSatang — ปัดขึ้น 2 ทศนิยม (สตางค์), float-robust + magnitude-safe
 *   - 0.1*0.2 → 0.02 (ไม่ใช่ 0.03 จาก float noise)
 *   - 1.001 → 1.01 (เศษจริง ดันขึ้น)
 *   - 7000.00 → 7000.00 (no bump)
 *   - 300_000_000.37 → 300_000_000.37 (no bump ที่ค่าใหญ่ — กัน spurious satang bump)
 *
 * เทคนิค: subtractive epsilon — `Math.ceil(x*100 - 1e-4) / 100`
 *   1e-4 cent (= 1e-6 บาท) absorb IEEE ULP noise; ต่ำกว่าสตางค์มาก ไม่ suppress เศษจริง.
 *   magnitude-safe ถึง x ≈ 9e13 บาท (x*100 ≤ MAX_SAFE_INTEGER ~9e15).
 *
 *   (วิธี pre-round ที่ precision สูง — `x*100*1e6` — ทำให้ผลคูณเกิน MAX_SAFE_INTEGER
 *    เมื่อ x > ~90M, ดันสตางค์เกินจริงในงานหลักร้อยล้าน. แก้แล้ว.)
 *
 * Guard:
 *   - non-finite → throw
 *   - x ≤ 0 → คืน 0 (กัน -0 ที่เกิดจาก `0*100-1e-4 = -0.0001 → ceil = -0` ;
 *     และ amount ในระบบ BOQ ห้ามติดลบ — defensive)
 */
export function ceilSatang(x: number): number {
  if (!Number.isFinite(x)) {
    throw new Error(`ceilSatang: input must be finite (got ${x})`);
  }
  if (x <= 0) return 0;
  return Math.ceil(x * 100 - 1e-4) / 100;
}

/**
 * floatClean — round nearest 2 ทศนิยม (สตางค์) เพื่อล้าง float noise จาก sum
 *   ใช้กับ subtotals ที่เป็น "ผลรวมของค่าที่ปัดแล้ว" — ห้าม ceil/floor ซ้ำ
 *   (จะเปลี่ยนผลรวมที่ควรจะเป๊ะ ให้เพี้ยน)
 */
function floatClean(x: number): number {
  return Math.round(x * 100) / 100;
}

// =============================================================================
// Types
// =============================================================================

/**
 * รายการ BOQ ที่ตั้งราคาแล้ว
 *   - material/labor แยกคอลัมน์ (ปร.4 ต้องการแยก)
 *   - kind ระบุปลายทาง: 'construction' → ปร.5ก (Factor F) ; 'procurement' → ปร.5ข (×1.07)
 *   - origin: 'derived' = สร้างจาก measurement ; 'manual' = ผู้ใช้กรอกเอง
 */
export type PricedLine = {
  id: string;
  description: string;
  /** unit string (ม., ตร.ม., ลบ.ม., ชุด ฯลฯ) — wide string ใน v1 ; enum ทางการยังไม่ระบุ */
  unit: string;
  qty: number;
  materialUnitPrice: number;
  laborUnitPrice: number;
  /** หมวดงาน สำหรับ ปร.4 grouping — wide string (ไม่มี enum ทางการที่บังคับ) */
  group: string;
  kind: 'construction' | 'procurement';
  origin: 'derived' | 'manual';
};

/** Factor F parameters ระดับโครงการ (ตาม contract terms) */
export type ProjectFactorParams = {
  advancePct: number;
  retentionPct: number;
  includeVAT: boolean;
};

// =============================================================================
// deriveLineAmounts — per-line DERIVED (ห้ามเก็บใน schema)
// =============================================================================

export type LineAmounts = {
  materialAmount: number;
  laborAmount: number;
  /** = materialAmount + laborAmount */
  total: number;
};

export function deriveLineAmounts(line: PricedLine): LineAmounts {
  // ceilSatang ที่จุดเกิดเศษจริง (qty × price); total = สองค่าที่ปัดแล้ว ห้าม ceil ซ้ำ
  const materialAmount = ceilSatang(line.qty * line.materialUnitPrice);
  const laborAmount = ceilSatang(line.qty * line.laborUnitPrice);
  return {
    materialAmount,
    laborAmount,
    total: materialAmount + laborAmount,
  };
}

// =============================================================================
// splitByKind — แยก lines เป็น construction (→ ปร.5ก) / procurement (→ ปร.5ข)
// =============================================================================

export function splitByKind(lines: PricedLine[]): {
  construction: PricedLine[];
  procurement: PricedLine[];
} {
  const construction: PricedLine[] = [];
  const procurement: PricedLine[] = [];
  for (const line of lines) {
    (line.kind === 'construction' ? construction : procurement).push(line);
  }
  return { construction, procurement };
}

// =============================================================================
// buildPr4 — ปร.4: group by `group` + grand totals
//
// 🔴 CROSS-PAGE SAFE: grand ทุกคอลัมน์คำนวณจาก "ทุก line อิสระ" ในรอบเดียว
//   (กันบั๊ก สพฐ ที่เคย sum-of-page-subtotals เอาเฉพาะหน้าสุดท้าย)
// =============================================================================

export type Pr4Group = {
  group: string;
  lineIds: string[];
  material: number;
  labor: number;
  total: number;
};

export type Pr4Result = {
  groups: Pr4Group[];
  grand: { material: number; labor: number; total: number };
};

export function buildPr4(lines: PricedLine[]): Pr4Result {
  const groupMap = new Map<string, Pr4Group>();
  // grand accumulators แยกจาก group — ทุก line บวกเข้า grand เสมอ
  let grandMaterial = 0;
  let grandLabor = 0;
  let grandTotal = 0;

  for (const line of lines) {
    const a = deriveLineAmounts(line);

    // grand: independent accumulators (ห้ามใช้ subtotal-of-subtotals)
    grandMaterial += a.materialAmount;
    grandLabor += a.laborAmount;
    grandTotal += a.total;

    // group bookkeeping
    let g = groupMap.get(line.group);
    if (!g) {
      g = { group: line.group, lineIds: [], material: 0, labor: 0, total: 0 };
      groupMap.set(line.group, g);
    }
    g.lineIds.push(line.id);
    g.material += a.materialAmount;
    g.labor += a.laborAmount;
    g.total += a.total;
  }

  // subtotals = ผลรวมของค่าที่ปัดแล้ว → float-clean (round nearest 2 dec) ห้าม ceil ซ้ำ
  return {
    groups: [...groupMap.values()].map((g) => ({
      ...g,
      material: floatClean(g.material),
      labor: floatClean(g.labor),
      total: floatClean(g.total),
    })),
    grand: {
      material: floatClean(grandMaterial),
      labor: floatClean(grandLabor),
      total: floatClean(grandTotal),
    },
  };
}

// =============================================================================
// buildPr5k — ปร.5ก: Factor F ครั้งเดียวบน construction cost total
//   (Factor F คูณระดับโครงการ ห้ามคูณต่อ line — Stage C ground rule)
// =============================================================================

export type Pr5kResult = {
  /** construction direct cost total (THB) */
  costTotal: number;
  /** Factor F จาก lookup ครั้งเดียวบน costTotal */
  factorF: number;
  /** verified flag ของตาราง Factor F ที่ใช้ */
  verified: boolean;
  /** = costTotal × factorF */
  ค่าก่อสร้าง: number;
};

export function buildPr5k(
  constructionCostTotal: number,
  factorParams: ProjectFactorParams,
): Pr5kResult {
  // input guard delegate ให้ lookupFactorF (cost ≤ 0 / NaN → throw)
  const { factorF, verified } = lookupFactorF({
    advancePct: factorParams.advancePct,
    retentionPct: factorParams.retentionPct,
    totalDirectCostTHB: constructionCostTotal,
    includeVAT: factorParams.includeVAT,
  });
  return {
    costTotal: constructionCostTotal,
    factorF,
    verified,
    // ceilSatang ที่จุดเกิดเศษจริง (cost × factorF)
    ค่าก่อสร้าง: ceilSatang(constructionCostTotal * factorF),
  };
}

// =============================================================================
// buildPr5kh — ปร.5ข: ครุภัณฑ์ (procurement) — VAT 7% เท่านั้น ไม่เข้า Factor F
// =============================================================================

/** VAT rate ที่ใช้กับ procurement (ครุภัณฑ์) — Thai VAT = 7% */
export const VAT_RATE = 0.07;

export type Pr5khResult = {
  /** Σ total ของทุก procurement line */
  งาน: number;
  /** = งาน × VAT_RATE */
  vat: number;
  /** = งาน × (1 + VAT_RATE) */
  ค่าก่อสร้าง: number;
};

export function buildPr5kh(procurementLines: PricedLine[]): Pr5khResult {
  // sanity: ไม่ filter kind ที่นี่ — caller responsibility (ใช้ splitByKind ก่อน)
  let งาน = 0;
  for (const line of procurementLines) {
    งาน += deriveLineAmounts(line).total;
  }
  // ceilSatang ที่จุดเกิดเศษจริง (vat = งาน × 0.07) ; ค่าก่อสร้าง = งาน + vat (ไม่ ceil ซ้ำ)
  const vat = ceilSatang(งาน * VAT_RATE);
  return {
    งาน,
    vat,
    ค่าก่อสร้าง: งาน + vat,
  };
}

// =============================================================================
// buildPr6 — ปร.6: รวม + ราคากลาง
// =============================================================================

export type Pr6Result = {
  /** = pr5k.ค่าก่อสร้าง + pr5kh.ค่าก่อสร้าง */
  รวม: number;
  /** = roundRatchaklang(รวม) — ปัจจุบัน identity จนกว่ากฎทางการจะยืนยัน */
  ราคากลาง: number;
};

// TODO(scope): กรณี procurement-only project (ไม่มี construction lines) ต้องสร้าง
//   pr5k อย่างไร — buildPr5k throw บน cost=0 (delegate to lookupFactorF guard).
//   ผู้เรียก/UI layer ต้อง branch กรณีนี้เอง (ข้าม pr5k หรือใช้ pr5kh เดี่ยว).
//   ยังไม่ระบุชัดในสเปก → ไม่เพิ่ม nullable overload ในรอบนี้.

export function buildPr6(pr5k: Pr5kResult, pr5kh: Pr5khResult): Pr6Result {
  // float-clean รวม (sum of two at-satang values อาจมี IEEE noise)
  const รวม = floatClean(pr5k.ค่าก่อสร้าง + pr5kh.ค่าก่อสร้าง);
  return {
    รวม,
    ราคากลาง: roundRatchaklang(รวม),
  };
}

// =============================================================================
// roundRatchaklang — ปัดลงเต็มบาท (ตัดสตางค์ทิ้ง), float-robust
// =============================================================================

/**
 * roundRatchaklang — floor เป็นเลขจำนวนเต็มบาท (ตัดสตางค์ทิ้ง), float-robust
 *
 * 🔴 X.00 ที่มี float noise ใต้ (เช่น 9097199.9999999 จาก 7M × 1.2996 ใน IEEE) ต้องได้
 * 9097200 ไม่ใช่ 9097199. ใช้ pre-round ที่ 1e-4 baht (0.01 satang) ก่อน floor
 * เพื่อ absorb noise จาก upstream multiplication.
 *
 * NOTE: ปัจจุบันเป็นกฎ "floor to baht" — ถ้ากฎกรมบัญชีกลางในอนาคตซับซ้อนกว่า
 * (เช่น ปัดเป็น 100/1,000 บาท ขึ้นกับขนาดงาน) ให้แก้ที่นี่ที่เดียว + update tests.
 */
export function roundRatchaklang(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error(`roundRatchaklang: input must be finite (got ${amount})`);
  }
  // pre-round absorbs noise like 9097199.9999999 → 9097200; 9097200.99 stays at 9097200.99
  const noiseFree = Math.round(amount * 1e4) / 1e4;
  return Math.floor(noiseFree);
}
