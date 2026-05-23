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
  const materialAmount = line.qty * line.materialUnitPrice;
  const laborAmount = line.qty * line.laborUnitPrice;
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

  return {
    groups: [...groupMap.values()],
    grand: { material: grandMaterial, labor: grandLabor, total: grandTotal },
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
    ค่าก่อสร้าง: constructionCostTotal * factorF,
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
  return {
    งาน,
    vat: งาน * VAT_RATE,
    ค่าก่อสร้าง: งาน * (1 + VAT_RATE),
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
  const รวม = pr5k.ค่าก่อสร้าง + pr5kh.ค่าก่อสร้าง;
  return {
    รวม,
    ราคากลาง: roundRatchaklang(รวม),
  };
}

// =============================================================================
// roundRatchaklang — TODO(spec): กฎปัดเศษ "ราคากลาง" กรมบัญชีกลาง
// =============================================================================

/**
 * roundRatchaklang — ปัดเศษ "ราคากลาง" ตามกฎทางการกรมบัญชีกลาง
 *
 * TODO: ใส่กฎปัดเศษราคากลาง กรมบัญชีกลาง เมื่อยืนยัน ; ห้ามเดา
 *   ความเป็นไปได้ที่ยังไม่ยืนยัน:
 *     - ปัดให้เหลือเลขนัยสำคัญ N (depend on magnitude?)
 *     - ปัดเป็นหลัก 100/1,000 บาท (ขึ้นกับขนาดงาน?)
 *     - กฎอื่น (เช่น ปัดลงเสมอ vs ปัดธรรมดา)
 *   ปัจจุบันคืน amount ตรงๆ (identity) — เพื่อไม่ให้ผลผิดก่อนกฎจะยืนยัน
 *   เมื่อยืนยันแล้ว ให้แก้ที่นี่ที่เดียว + อัปเดต tests จาก it.todo
 */
export function roundRatchaklang(amount: number): number {
  return amount;
}
