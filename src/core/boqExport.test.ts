// src/core/boqExport.test.ts — Layer 1 PURE roll-up: ปร.4/5ก/5ข/6
import { describe, it, expect } from 'vitest';
import {
  ceilSatang,
  deriveLineAmounts,
  splitByKind,
  buildPr4,
  buildPr5k,
  buildPr5kh,
  buildPr6,
  roundRatchaklang,
  VAT_RATE,
  type PricedLine,
  type ProjectFactorParams,
} from './boqExport';
import { lookupFactorF } from './factorF';

// =============================================================================
// helpers
// =============================================================================

/** สร้าง line ที่ material = qty×materialUnitPrice (laborUnitPrice=0) — ใช้คุม total ตรงๆ */
function mkLine(
  id: string,
  materialAmount: number,
  kind: 'construction' | 'procurement',
  opts: { group?: string; labor?: number } = {},
): PricedLine {
  return {
    id,
    description: id,
    unit: 'ลส.',
    qty: 1,
    materialUnitPrice: materialAmount,
    laborUnitPrice: opts.labor ?? 0,
    group: opts.group ?? 'หมวด-default',
    kind,
    origin: 'derived',
  };
}

// =============================================================================
// ceilSatang — float-robust ceil to 2 dec
// =============================================================================
describe('ceilSatang: no-bump (float noise ห้ามดันขึ้น)', () => {
  it('0.1 * 0.2 = 0.020000000000000004 → 0.02 (ไม่ใช่ 0.03)', () => {
    expect(ceilSatang(0.1 * 0.2)).toBe(0.02);
  });
  it('7 * 0.07 = 0.49000000000000005 → 0.49', () => {
    expect(ceilSatang(7 * 0.07)).toBe(0.49);
  });
  it('7000.00 → 7000.00', () => {
    expect(ceilSatang(7000.0)).toBe(7000);
  });
  it('12000000.00 → 12000000.00', () => {
    expect(ceilSatang(12_000_000.0)).toBe(12_000_000);
  });
  it('0 → 0', () => {
    expect(ceilSatang(0)).toBe(0);
  });
});

describe('ceilSatang: bump เศษจริง', () => {
  it('1.001 → 1.01', () => {
    expect(ceilSatang(1.001)).toBe(1.01);
  });
  it('0.3301 → 0.34', () => {
    expect(ceilSatang(0.3301)).toBe(0.34);
  });
  it('2.671 → 2.68', () => {
    expect(ceilSatang(2.671)).toBe(2.68);
  });
  it('0.330 → 0.33 (no fictitious bump จาก trailing zero)', () => {
    expect(ceilSatang(0.33)).toBe(0.33);
  });
});

describe('ceilSatang: magnitude-safe (>90M บาท — กัน spurious bump เพราะ MAX_SAFE_INTEGER)', () => {
  it('300_000_000.37 → 300_000_000.37 (ค่าใหญ่ + สตางค์ลงตัว ห้ามดัน)', () => {
    expect(ceilSatang(300_000_000.37)).toBe(300_000_000.37);
  });
  it('300_000_000.371 → 300_000_000.38 (เศษจริงค่าใหญ่ → ดันขึ้น)', () => {
    expect(ceilSatang(300_000_000.371)).toBe(300_000_000.38);
  });
  it('360_000_000 → 360_000_000 (ค่าใหญ่ลงตัว — integer)', () => {
    expect(ceilSatang(360_000_000)).toBe(360_000_000);
  });
});

describe('ceilSatang: input guard', () => {
  it('NaN → throw', () => {
    expect(() => ceilSatang(Number.NaN)).toThrow();
  });
  it('Infinity → throw', () => {
    expect(() => ceilSatang(Number.POSITIVE_INFINITY)).toThrow();
  });
  it('-1 → 0 (defensive: amount ในระบบ BOQ ห้ามติดลบ)', () => {
    expect(ceilSatang(-1)).toBe(0);
  });
  it('-0.0001 → 0 (กัน -0 จาก 0*100-1e-4 = -0.0001)', () => {
    expect(ceilSatang(-0.0001)).toBe(0);
  });
  it('Object.is(ceilSatang(0), 0) === true (กัน -0 bit-pattern)', () => {
    // -0 และ +0 เปรียบกับ === ได้ true แต่ Object.is แยก ; toBe ใช้ Object.is ภายใน
    expect(Object.is(ceilSatang(0), 0)).toBe(true);
  });
});

// =============================================================================
// roundRatchaklang — floor to whole baht, float-robust
// =============================================================================
describe('roundRatchaklang: no-drop (float noise ใต้ X.00 ห้ามตก X-1)', () => {
  it('9097199.9999999 → 9097200 (= 7M × 1.2996 ใน IEEE)', () => {
    expect(roundRatchaklang(9_097_199.9999999)).toBe(9_097_200);
  });
  it('9097200.00 → 9097200', () => {
    expect(roundRatchaklang(9_097_200.0)).toBe(9_097_200);
  });
  it('7_000_000 × 1.2996 → 9_097_200 (end-to-end ผ่าน IEEE)', () => {
    expect(roundRatchaklang(7_000_000 * 1.2996)).toBe(9_097_200);
  });
});

describe('roundRatchaklang: floor เศษจริง (ตัดสตางค์ทิ้ง)', () => {
  it('9097200.99 → 9097200', () => {
    expect(roundRatchaklang(9_097_200.99)).toBe(9_097_200);
  });
  it('9097200.01 → 9097200', () => {
    expect(roundRatchaklang(9_097_200.01)).toBe(9_097_200);
  });
  it('100.50 → 100', () => {
    expect(roundRatchaklang(100.5)).toBe(100);
  });
  it('0.99 → 0', () => {
    expect(roundRatchaklang(0.99)).toBe(0);
  });
  it('0 → 0', () => {
    expect(roundRatchaklang(0)).toBe(0);
  });
});

describe('roundRatchaklang: input guard', () => {
  it('NaN → throw', () => {
    expect(() => roundRatchaklang(Number.NaN)).toThrow();
  });
});

// =============================================================================
// deriveLineAmounts — math
// =============================================================================
describe('deriveLineAmounts: qty × price แยก material/labor', () => {
  it('qty=10, material=100, labor=50 → material 1000, labor 500, total 1500', () => {
    const a = deriveLineAmounts({
      id: 'X',
      description: 'x',
      unit: 'ตร.ม.',
      qty: 10,
      materialUnitPrice: 100,
      laborUnitPrice: 50,
      group: 'g',
      kind: 'construction',
      origin: 'derived',
    });
    expect(a.materialAmount).toBe(1000);
    expect(a.laborAmount).toBe(500);
    expect(a.total).toBe(1500);
  });
  it('qty=0 → ทุก amount = 0', () => {
    const a = deriveLineAmounts({
      id: 'X',
      description: 'x',
      unit: 'ม.',
      qty: 0,
      materialUnitPrice: 100,
      laborUnitPrice: 50,
      group: 'g',
      kind: 'construction',
      origin: 'derived',
    });
    expect(a.total).toBe(0);
  });
});

// =============================================================================
// splitByKind
// =============================================================================
describe('splitByKind: แยก construction / procurement', () => {
  it('คัด kind ถูกต้อง + คงลำดับเดิม', () => {
    const lines: PricedLine[] = [
      mkLine('C1', 1, 'construction'),
      mkLine('P1', 1, 'procurement'),
      mkLine('C2', 1, 'construction'),
      mkLine('P2', 1, 'procurement'),
    ];
    const { construction, procurement } = splitByKind(lines);
    expect(construction.map((l) => l.id)).toEqual(['C1', 'C2']);
    expect(procurement.map((l) => l.id)).toEqual(['P1', 'P2']);
  });
  it('empty → ทั้งสองอาเรย์ว่าง', () => {
    const { construction, procurement } = splitByKind([]);
    expect(construction).toEqual([]);
    expect(procurement).toEqual([]);
  });
});

// =============================================================================
// buildPr4 — CROSS-PAGE SAFE grand totals (regression for สพฐ bug)
// =============================================================================
describe('buildPr4: 2 หมวด หลาย line, grand = Σ ของทุก line อิสระ', () => {
  const lines: PricedLine[] = [
    // หมวด A: 3 lines
    {
      id: 'A1',
      description: 'a1',
      unit: 'ตร.ม.',
      qty: 10,
      materialUnitPrice: 100,
      laborUnitPrice: 50,
      group: 'งานโครงสร้าง',
      kind: 'construction',
      origin: 'derived',
    }, // mat=1000, lab=500, tot=1500
    {
      id: 'A2',
      description: 'a2',
      unit: 'ตร.ม.',
      qty: 20,
      materialUnitPrice: 200,
      laborUnitPrice: 100,
      group: 'งานโครงสร้าง',
      kind: 'construction',
      origin: 'derived',
    }, // mat=4000, lab=2000, tot=6000
    {
      id: 'A3',
      description: 'a3',
      unit: 'ตร.ม.',
      qty: 5,
      materialUnitPrice: 300,
      laborUnitPrice: 150,
      group: 'งานโครงสร้าง',
      kind: 'construction',
      origin: 'derived',
    }, // mat=1500, lab=750, tot=2250
    // หมวด B: 2 lines
    {
      id: 'B1',
      description: 'b1',
      unit: 'ตร.ม.',
      qty: 8,
      materialUnitPrice: 150,
      laborUnitPrice: 75,
      group: 'งานสถาปัตยกรรม',
      kind: 'construction',
      origin: 'derived',
    }, // mat=1200, lab=600, tot=1800
    {
      id: 'B2',
      description: 'b2',
      unit: 'ตร.ม.',
      qty: 4,
      materialUnitPrice: 250,
      laborUnitPrice: 125,
      group: 'งานสถาปัตยกรรม',
      kind: 'construction',
      origin: 'derived',
    }, // mat=1000, lab=500, tot=1500
  ];
  const r = buildPr4(lines);

  it('groups = 2 หมวด', () => {
    expect(r.groups).toHaveLength(2);
  });
  it('หมวด A: material=6500, labor=3250, total=9750 + lineIds ครบ', () => {
    const a = r.groups.find((g) => g.group === 'งานโครงสร้าง')!;
    expect(a.material).toBe(6500);
    expect(a.labor).toBe(3250);
    expect(a.total).toBe(9750);
    expect(a.lineIds).toEqual(['A1', 'A2', 'A3']);
  });
  it('หมวด B: material=2200, labor=1100, total=3300', () => {
    const b = r.groups.find((g) => g.group === 'งานสถาปัตยกรรม')!;
    expect(b.material).toBe(2200);
    expect(b.labor).toBe(1100);
    expect(b.total).toBe(3300);
  });
  it('grand: ทุกคอลัมน์ = Σ ของทุก line (ไม่ใช่กลุ่ม/หน้าสุดท้าย)', () => {
    expect(r.grand.material).toBe(8700); // 6500 + 2200
    expect(r.grand.labor).toBe(4350); // 3250 + 1100
    expect(r.grand.total).toBe(13050); // 9750 + 3300
  });
  it('regression สพฐ: grand.labor ห้ามเท่ากับ ของกลุ่มเดียว', () => {
    // ถ้า bug = subtotal-of-subtotals แบบเอาเฉพาะหน้าสุดท้าย, grand.labor จะ = 1100 (หมวด B)
    expect(r.grand.labor).not.toBe(1100);
    expect(r.grand.labor).not.toBe(3250);
  });
  it('grand consistency: เท่ากับ Σ deriveLineAmounts ทุก line อิสระ', () => {
    const expected = lines.reduce(
      (acc, l) => {
        const a = deriveLineAmounts(l);
        return {
          material: acc.material + a.materialAmount,
          labor: acc.labor + a.laborAmount,
          total: acc.total + a.total,
        };
      },
      { material: 0, labor: 0, total: 0 },
    );
    expect(r.grand).toEqual(expected);
  });
  it('empty lines → groups=[], grand=0/0/0', () => {
    const empty = buildPr4([]);
    expect(empty.groups).toEqual([]);
    expect(empty.grand).toEqual({ material: 0, labor: 0, total: 0 });
  });
});

// =============================================================================
// per-line-ceil-then-sum ≠ sum-then-ceil
//   3 lines, each materialUnitPrice=0.331 (qty=1) → per-line ceil = 0.34 each
//   Σ per-line = 1.02 ; ผิดถ้าทำ sum-first-then-ceil = ceil(0.993) = 1.00
// =============================================================================
describe('buildPr4: per-line-ceil-then-sum ห้ามเป็น sum-then-ceil', () => {
  const lines: PricedLine[] = [
    mkLine('L1', 0.331, 'construction', { group: 'g' }),
    mkLine('L2', 0.331, 'construction', { group: 'g' }),
    mkLine('L3', 0.331, 'construction', { group: 'g' }),
  ];
  const r = buildPr4(lines);

  it('แต่ละ line: ceilSatang(0.331) = 0.34', () => {
    for (const l of lines) {
      expect(deriveLineAmounts(l).materialAmount).toBe(0.34);
    }
  });
  it('grand.material = 0.34 × 3 = 1.02 (per-line ceil ก่อนสรุป)', () => {
    expect(r.grand.material).toBe(1.02);
  });
  it('regression: grand.material ห้ามเป็น 1.00 (= sum-then-ceil ที่ผิด)', () => {
    // 0.331 + 0.331 + 0.331 = 0.993 → ถ้า ceil ทีหลังจะได้ 1.00 (ผิด)
    expect(r.grand.material).not.toBe(1.0);
  });
});

// =============================================================================
// buildPr5k — Factor F ครั้งเดียวบน total (a0r0 test-verified)
// =============================================================================
describe('buildPr5k: Factor F คูณครั้งเดียวบน construction total (a0r0)', () => {
  const params: ProjectFactorParams = {
    advancePct: 0,
    retentionPct: 0,
    includeVAT: true,
  };

  it('total = 7M THB → factorF≈1.2996, ค่าก่อสร้าง = ceilSatang(7e6 × 1.2996) = 9,097,200', () => {
    const r = buildPr5k(7_000_000, params);
    expect(r.factorF).toBeCloseTo(1.2996, 4);
    expect(r.costTotal).toBe(7_000_000);
    expect(r.verified).toBe(true);
    expect(r.ค่าก่อสร้าง).toBe(9_097_200);
  });

  it('2 lines (4M + 3M) สรุปยอด 7M → ผลตรงกับ 1 line 7M (factor F ครั้งเดียว)', () => {
    const twoLines = [
      mkLine('X', 4_000_000, 'construction'),
      mkLine('Y', 3_000_000, 'construction'),
    ];
    const oneLine = [mkLine('Z', 7_000_000, 'construction')];
    const sumTwo = twoLines.reduce(
      (s, l) => s + deriveLineAmounts(l).total,
      0,
    );
    const sumOne = oneLine.reduce(
      (s, l) => s + deriveLineAmounts(l).total,
      0,
    );
    expect(sumTwo).toBe(sumOne); // sanity

    const r2 = buildPr5k(sumTwo, params);
    const r1 = buildPr5k(sumOne, params);
    expect(r2.factorF).toBe(r1.factorF);
    expect(r2.ค่าก่อสร้าง).toBe(r1.ค่าก่อสร้าง);
  });

  it('negative: per-line Factor F จะได้ผลต่าง (ยืนยันว่าใช้บน total เท่านั้น)', () => {
    const f4M = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 4_000_000,
      includeVAT: true,
    }).factorF;
    const f3M = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 3_000_000,
      includeVAT: true,
    }).factorF;
    const wrongPerLine = 4_000_000 * f4M + 3_000_000 * f3M;
    const correctOnTotal = 7_000_000 * 1.2996;
    expect(wrongPerLine).not.toBeCloseTo(correctOnTotal, 1);
  });

  it('cost=0 → throw (delegate to lookupFactorF guard)', () => {
    expect(() => buildPr5k(0, params)).toThrow();
  });
});

// =============================================================================
// buildPr5kh — procurement VAT only (ไม่เข้า Factor F)
// =============================================================================
describe('buildPr5kh: procurement (VAT 7% เท่านั้น)', () => {
  // หลัง ceilSatang vat แล้ว ค่าควรเป็น integer เป๊ะ → toBe ได้
  it('1 line 100,000 → งาน=100k, vat=7k (ceilSatang ลบ noise), ค่าก่อสร้าง=107k', () => {
    const r = buildPr5kh([mkLine('P1', 100_000, 'procurement')]);
    expect(r.งาน).toBe(100_000);
    expect(r.vat).toBe(7_000);
    expect(r.ค่าก่อสร้าง).toBe(107_000);
  });
  it('หลาย line: 60k + 40k = 100k → vat=7k, ค่าก่อสร้าง=107k', () => {
    const r = buildPr5kh([
      mkLine('P1', 60_000, 'procurement'),
      mkLine('P2', 40_000, 'procurement'),
    ]);
    expect(r.งาน).toBe(100_000);
    expect(r.vat).toBe(7_000);
    expect(r.ค่าก่อสร้าง).toBe(107_000);
  });
  it('empty → ทุกฟิลด์ = 0', () => {
    const r = buildPr5kh([]);
    expect(r.งาน).toBe(0);
    expect(r.vat).toBe(0);
    expect(r.ค่าก่อสร้าง).toBe(0);
  });
  it('VAT_RATE = 0.07 (Thai VAT)', () => {
    expect(VAT_RATE).toBe(0.07);
  });
});

// =============================================================================
// buildPr6 ROUND-TRIP — รวม = construction×F + procurement×1.07
// =============================================================================
describe('buildPr6: ROUND-TRIP รวม = Σconstruction×F + Σprocurement×1.07', () => {
  it('mixed lines (4M+3M construction + 100k procurement) → คำนวณตรง', () => {
    const lines: PricedLine[] = [
      mkLine('C1', 4_000_000, 'construction'),
      mkLine('C2', 3_000_000, 'construction'),
      mkLine('P1', 100_000, 'procurement'),
    ];
    const { construction, procurement } = splitByKind(lines);
    const constTotal = construction.reduce(
      (s, l) => s + deriveLineAmounts(l).total,
      0,
    );
    expect(constTotal).toBe(7_000_000);

    const pr5k = buildPr5k(constTotal, {
      advancePct: 0,
      retentionPct: 0,
      includeVAT: true,
    });
    const pr5kh = buildPr5kh(procurement);
    const pr6 = buildPr6(pr5k, pr5kh);

    // หลัง ceilSatang ทั้ง 5ก/5ข ค่าเป็น integer แล้ว → exact compare ได้
    expect(pr5k.ค่าก่อสร้าง).toBe(9_097_200); // ceilSatang(7M × 1.2996)
    expect(pr5kh.ค่าก่อสร้าง).toBe(107_000); // 100k + ceilSatang(7000.000...01) = 100k + 7000
    expect(pr6.รวม).toBe(9_204_200);
    // ราคากลาง = floor (integer total → unchanged)
    expect(pr6.ราคากลาง).toBe(9_204_200);
  });
});

// =============================================================================
// buildPr6: ราคากลาง = floor ของ รวม (non-integer total case)
// =============================================================================
describe('buildPr6: ราคากลาง = floor ของ รวม (real fraction case)', () => {
  it('procurement non-integer → ราคากลาง = floor(รวม), เต็มบาท ≤ รวม', () => {
    const construction = mkLine('C', 7_000_000, 'construction');
    const procurement = mkLine('P', 100_000.5, 'procurement');
    const constTotal = deriveLineAmounts(construction).total;
    const pr5k = buildPr5k(constTotal, {
      advancePct: 0,
      retentionPct: 0,
      includeVAT: true,
    });
    const pr5kh = buildPr5kh([procurement]);
    const pr6 = buildPr6(pr5k, pr5kh);

    // ค่าก่อสร้าง 5ก = ceilSatang(7M × 1.2996) = 9,097,200
    expect(pr5k.ค่าก่อสร้าง).toBe(9_097_200);
    // ค่าก่อสร้าง 5ข = 100,000.50 + ceilSatang(7000.035) = 100,000.50 + 7000.04 = 107,000.54
    expect(pr5kh.vat).toBeCloseTo(7000.04, 2);
    expect(pr5kh.ค่าก่อสร้าง).toBeCloseTo(107_000.54, 2);

    expect(pr6.รวม).toBeCloseTo(9_204_200.54, 2);
    expect(pr6.ราคากลาง).toBe(9_204_200);
    expect(pr6.ราคากลาง).toBeLessThanOrEqual(pr6.รวม);
    expect(Number.isInteger(pr6.ราคากลาง)).toBe(true);
  });
});
