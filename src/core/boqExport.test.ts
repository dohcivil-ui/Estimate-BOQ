// src/core/boqExport.test.ts — Layer 1 PURE roll-up: ปร.4/5ก/5ข/6
import { describe, it, expect } from 'vitest';
import {
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
// buildPr5k — Factor F ครั้งเดียวบน total (a0r0 test-verified)
// =============================================================================
describe('buildPr5k: Factor F คูณครั้งเดียวบน construction total (a0r0)', () => {
  const params: ProjectFactorParams = {
    advancePct: 0,
    retentionPct: 0,
    includeVAT: true,
  };

  it('total = 7M THB → factorF≈1.2996, ค่าก่อสร้าง = 7e6 × 1.2996', () => {
    const r = buildPr5k(7_000_000, params);
    expect(r.factorF).toBeCloseTo(1.2996, 4);
    expect(r.costTotal).toBe(7_000_000);
    expect(r.verified).toBe(true);
    expect(r.ค่าก่อสร้าง).toBeCloseTo(7_000_000 * 1.2996, 1);
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
  // ใช้ toBeCloseTo สำหรับ vat/ค่าก่อสร้าง — IEEE 100_000 × 0.07 = 7000.000000000001
  it('1 line 100,000 → งาน=100k, vat≈7k, ค่าก่อสร้าง≈107k', () => {
    const r = buildPr5kh([mkLine('P1', 100_000, 'procurement')]);
    expect(r.งาน).toBe(100_000);
    expect(r.vat).toBeCloseTo(7_000, 6);
    expect(r.ค่าก่อสร้าง).toBeCloseTo(107_000, 6);
  });
  it('หลาย line: 60k + 40k = 100k → vat≈7k, ค่าก่อสร้าง≈107k', () => {
    const r = buildPr5kh([
      mkLine('P1', 60_000, 'procurement'),
      mkLine('P2', 40_000, 'procurement'),
    ]);
    expect(r.งาน).toBe(100_000);
    expect(r.vat).toBeCloseTo(7_000, 6);
    expect(r.ค่าก่อสร้าง).toBeCloseTo(107_000, 6);
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

    // คำนวณอิสระ (ไม่ผ่าน builder)
    const expectedConstruction = 7_000_000 * 1.2996; // a0r0 7M VAT
    const expectedProcurement = 100_000 * 1.07;
    expect(pr6.รวม).toBeCloseTo(
      expectedConstruction + expectedProcurement,
      1,
    );
    // identity จนกว่า roundRatchaklang จะมีกฎทางการ
    expect(pr6.ราคากลาง).toBe(pr6.รวม);
  });
});

// =============================================================================
// roundRatchaklang — TODO รอกฎทางการ
// =============================================================================
describe('roundRatchaklang: TODO (รอกฎปัดเศษกรมบัญชีกลาง)', () => {
  it.todo(
    'ใส่กฎปัดเศษราคากลาง กรมบัญชีกลาง เมื่อยืนยัน — ห้ามเดา',
  );
  it('ปัจจุบัน = identity (passthrough) จนกว่ากฎจะยืนยัน', () => {
    expect(roundRatchaklang(123_456.789)).toBe(123_456.789);
    expect(roundRatchaklang(0)).toBe(0);
    expect(roundRatchaklang(7_000_000 * 1.2996)).toBe(7_000_000 * 1.2996);
  });
});
