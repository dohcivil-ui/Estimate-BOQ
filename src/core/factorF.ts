// src/core/factorF.ts — PURE: Factor F lookup (Office of the Council ว.499)
//
// ห้าม import React/Konva. ห้ามแตะ formula.ts (Stage C scope).
//
// ตารางสำเร็จ 12 ชุด (advance × retention) สำหรับงานอาคารอยู่ที่
// ./factorF.constants. ลูคอัพอ่านตามค่า (adv, ret) → bracket + linear interp
// + clamp ปลาย (ห้าม extrapolate).
//
// ความรับผิดชอบของ caller / gate layer:
//   - Factor F คูณ "ครั้งเดียว" ระดับโครงการ (ปร.5ก) — ไม่คูณรายรายการ BOQ
//   - ถ้า result.verified === false → ควร warn ผู้ใช้ (รอ spot-check ตารางนั้น)
//
// circular import note: factorF.constants.ts ใช้ `import type` มาเอาแค่ shape
// เท่านั้น (eliminated at runtime) — ไม่เกิด evaluation cycle.

import { BUILDING_TABLES } from './factorF.constants';

/** ประเภทงาน — ตอนนี้มีแค่ 'building'. TODO(stage-d+): 'road' | 'irrigation' ฯลฯ */
export type WorkType = 'building';

/** หนึ่งแถวในตาราง — costM = ค่าก่อสร้างรวม (ล้านบาท) ที่เป็น boundary upper */
export type FactorRow = {
  costM: number;
  /** Factor F ไม่รวม VAT */
  noVat: number;
  /** Factor F รวม VAT */
  vat: number;
};

/**
 * ตาราง Factor F หนึ่งชุด (1 (adv,ret)) — rows ต้องเรียง asc by costM
 *
 * รูปแบบเอกสาร ว.499: แถวสุดท้ายในเอกสารคือ ">500" — เป็น **step ค่าเดียว**
 * สำหรับงานที่ค่าก่อสร้างเกิน 500 ล้านบาท (ห้าม interpolate). เก็บแยกที่ field
 * `above` ไม่ปนใน rows เพื่อกัน bug "interp ระหว่าง 500 ↔ ค่า ">500" sentinel"
 * (เคยเก็บ costM=999999 ใน rows → interp ที่ 700M ได้ ~1.1871 ผิด ; ต้องเป็น 1.1805).
 */
export type FactorTable = {
  advancePct: number;
  retentionPct: number;
  /** true = มี test ground-truth ; false = ยังต้อง spot-check (gate ควร warn) */
  verified: boolean;
  /** 23 finite rows asc by costM (0.5..500 ล้านบาท) */
  rows: FactorRow[];
  /** step ">500" — ใช้เมื่อ costM > rows[last].costM (ห้าม interpolate, ห้าม clamp ปลายบน) */
  above: { noVat: number; vat: number };
};

export type LookupFactorFInput = {
  advancePct: number;
  retentionPct: number;
  totalDirectCostTHB: number;
  includeVAT: boolean;
};

export type LookupFactorFResult = {
  /** ค่า Factor F หลัง interp/clamp */
  factorF: number;
  /** ทบไว้: ตารางต้นทางถูกตรวจ ground-truth แล้วหรือยัง */
  verified: boolean;
};

/**
 * lookupFactorF — เลือก table จาก (advancePct, retentionPct) แล้ว interp/clamp/step
 *   Factor F บน costM = totalDirectCostTHB / 1e6 บนคอลัมน์ (noVat | vat).
 *
 * Rules:
 *   - ไม่มี table ตรง (adv,ret) → throw
 *   - totalDirectCostTHB ≤ 0 / NaN → throw
 *   - costM ≤ rows[0].costM      → clamp = rows[0][col] (ปลายล่าง)
 *   - costM > rows[last].costM   → table.above[col] (step ">500", ห้าม interpolate)
 *   - costM == rows[last].costM  → rows[last][col] (boundary ที่ rows[last] ไม่ใช่ step)
 *   - มิฉะนั้น linear interp ใน rows ระหว่าง bracket (lo, hi) แรกที่ costM ≤ hi.costM
 */
export function lookupFactorF(input: LookupFactorFInput): LookupFactorFResult {
  if (!(input.totalDirectCostTHB > 0)) {
    throw new Error(
      `lookupFactorF: totalDirectCostTHB must be > 0 (got ${input.totalDirectCostTHB})`,
    );
  }
  const table = BUILDING_TABLES.find(
    (t) =>
      t.advancePct === input.advancePct && t.retentionPct === input.retentionPct,
  );
  if (!table) {
    throw new Error(
      `lookupFactorF: no Factor F table for advance=${input.advancePct}%, ` +
        `retention=${input.retentionPct}% (building work)`,
    );
  }

  const col: 'noVat' | 'vat' = input.includeVAT ? 'vat' : 'noVat';
  const rows = table.rows;
  const costM = input.totalDirectCostTHB / 1e6;

  // clamp lower
  const first = rows[0]!;
  if (costM <= first.costM) {
    return { factorF: first[col], verified: table.verified };
  }
  // step ">500" — strict > (ไม่ใช่ ≥) เพื่อให้ boundary ที่ rows[last] เข้า interp branch
  const last = rows[rows.length - 1]!;
  if (costM > last.costM) {
    return { factorF: table.above[col], verified: table.verified };
  }
  // bracket + linear interp (รวมเคส costM == last.costM ที่ frac=1 → คืน last[col])
  for (let i = 1; i < rows.length; i++) {
    const hi = rows[i]!;
    if (costM <= hi.costM) {
      const lo = rows[i - 1]!;
      const frac = (costM - lo.costM) / (hi.costM - lo.costM);
      return {
        factorF: lo[col] + frac * (hi[col] - lo[col]),
        verified: table.verified,
      };
    }
  }
  // unreachable: lower clamp + upper step + loop ครอบทุกค่า > first.costM
  throw new Error('lookupFactorF: bracket search failed (unreachable)');
}
