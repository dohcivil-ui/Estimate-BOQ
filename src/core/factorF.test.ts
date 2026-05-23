// src/core/factorF.test.ts — Stage C: Factor F lookup (ว.499, building 12 tables)
import { describe, it, expect } from 'vitest';
import { lookupFactorF } from './factorF';
import { BUILDING_TABLES } from './factorF.constants';

// =============================================================================
// A) REAL — a0r0 (test-verified ground truth)
// =============================================================================
describe('Factor F: REAL a0r0 (table-verified ground truth)', () => {
  it('7M THB + VAT → 1.2996 (interp 5↔10)', () => {
    const r = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 7_000_000,
      includeVAT: true,
    });
    expect(r.factorF).toBeCloseTo(1.2996, 4);
    expect(r.verified).toBe(true);
  });

  it('12M THB + VAT → 1.2820 (interp 10↔15)', () => {
    const r = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 12_000_000,
      includeVAT: true,
    });
    expect(r.factorF).toBeCloseTo(1.2820, 4);
  });

  it('0.3M THB + VAT → 1.3091 (clamp ปลายล่าง = rows[0])', () => {
    const r = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 300_000,
      includeVAT: true,
    });
    expect(r.factorF).toBeCloseTo(1.3091, 4);
  });

  it('0.4M THB + no-VAT → 1.2235 (clamp ปลายล่าง = rows[0])', () => {
    const r = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 400_000,
      includeVAT: false,
    });
    expect(r.factorF).toBeCloseTo(1.2235, 4);
  });
});

// =============================================================================
// B) SYNTHETIC — interp midpoint = average ของ bracket
// =============================================================================
describe('Factor F: synthetic — interp midpoint = avg of bracket (a0r0)', () => {
  it('costM=7.5 (กึ่งกลาง 5↔10) noVat = avg(1.2169, 1.2113)', () => {
    const r = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 7_500_000,
      includeVAT: false,
    });
    expect(r.factorF).toBeCloseTo((1.2169 + 1.2113) / 2, 6);
  });
  it('costM=12.5 (กึ่งกลาง 10↔15) vat = avg(1.2960, 1.2611)', () => {
    const r = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 12_500_000,
      includeVAT: true,
    });
    expect(r.factorF).toBeCloseTo((1.2960 + 1.2611) / 2, 6);
  });
});

// =============================================================================
// clamp ปลายล่าง (≤ rows[0])
// =============================================================================
describe('Factor F: clamp ปลายล่าง (costM ≤ rows[0].costM)', () => {
  it('costM ต่ำกว่า rows[0] (0.1M) → rows[0].vat = 1.3091', () => {
    const r = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 100_000,
      includeVAT: true,
    });
    expect(r.factorF).toBeCloseTo(1.3091, 4);
  });
});

// =============================================================================
// step ">500" — table.above (ห้าม interpolate, ห้าม clamp แบบ ≥)
//   Boundary semantics:
//     costM == 500 (rows[last]) → rows[last] value (NOT step)
//     costM >  500              → table.above (step)
// =============================================================================
describe('Factor F: step ">500" (a0r0; ปิดบั๊ก interp 500↔999999)', () => {
  it('500M VAT → 1.1871 (boundary เป๊ะ = rows[last].vat)', () => {
    const r = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 500_000_000,
      includeVAT: true,
    });
    expect(r.factorF).toBeCloseTo(1.1871, 4);
  });

  it('500M no-VAT → 1.1095 (boundary = rows[last].noVat)', () => {
    const r = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 500_000_000,
      includeVAT: false,
    });
    expect(r.factorF).toBeCloseTo(1.1095, 4);
  });

  it('501M VAT → 1.1805 (ก้าวข้าม step ; ไม่ interpolate)', () => {
    const r = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 501_000_000,
      includeVAT: true,
    });
    expect(r.factorF).toBeCloseTo(1.1805, 4);
  });

  it('700M VAT → 1.1805 (>500 step ; เคยคืน ~1.1871 = บั๊ก ก่อนแยก above)', () => {
    const r = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 700_000_000,
      includeVAT: true,
    });
    expect(r.factorF).toBeCloseTo(1.1805, 4);
  });

  it('1e15 THB VAT → 1.1805 (extreme; ยัง step ไม่ extrapolate)', () => {
    const r = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 1e15,
      includeVAT: true,
    });
    expect(r.factorF).toBeCloseTo(1.1805, 4);
  });

  it('999999M no-VAT → 1.1033 (= table.above.noVat)', () => {
    const r = lookupFactorF({
      advancePct: 0,
      retentionPct: 0,
      totalDirectCostTHB: 999_999 * 1_000_000,
      includeVAT: false,
    });
    expect(r.factorF).toBeCloseTo(1.1033, 4);
  });
});

// =============================================================================
// error paths
// =============================================================================
describe('Factor F: error paths', () => {
  it('table (adv=20, ret=0) ไม่มี → throw', () => {
    expect(() =>
      lookupFactorF({
        advancePct: 20,
        retentionPct: 0,
        totalDirectCostTHB: 10_000_000,
        includeVAT: true,
      }),
    ).toThrow(/no Factor F table/);
  });
  it('table (adv=0, ret=15) ไม่มี → throw', () => {
    expect(() =>
      lookupFactorF({
        advancePct: 0,
        retentionPct: 15,
        totalDirectCostTHB: 10_000_000,
        includeVAT: true,
      }),
    ).toThrow(/no Factor F table/);
  });
  it('totalDirectCostTHB = 0 → throw', () => {
    expect(() =>
      lookupFactorF({
        advancePct: 0,
        retentionPct: 0,
        totalDirectCostTHB: 0,
        includeVAT: true,
      }),
    ).toThrow();
  });
  it('totalDirectCostTHB < 0 → throw', () => {
    expect(() =>
      lookupFactorF({
        advancePct: 0,
        retentionPct: 0,
        totalDirectCostTHB: -1,
        includeVAT: true,
      }),
    ).toThrow();
  });
  it('totalDirectCostTHB = NaN → throw', () => {
    expect(() =>
      lookupFactorF({
        advancePct: 0,
        retentionPct: 0,
        totalDirectCostTHB: Number.NaN,
        includeVAT: true,
      }),
    ).toThrow();
  });
});

// =============================================================================
// C) CONSISTENCY — vat ≈ round(noVat × 1.07, 4) ทุกแถว + above ทุกตาราง
//    จับ transcription error ; tolerance 0.0003 (เผื่อ rounding 4th decimal)
// =============================================================================
describe('Factor F: consistency (vat ≈ round(noVat × 1.07, 4), tol 0.0003)', () => {
  it('rows + above ของทุกตารางผ่าน vat-from-noVat check', () => {
    const failures: string[] = [];
    const check = (
      tag: string,
      noVat: number,
      vat: number,
    ): void => {
      const expected = Math.round(noVat * 1.07 * 10000) / 10000;
      const diff = Math.abs(vat - expected);
      if (diff > 0.0003) {
        failures.push(
          `${tag}: noVat=${noVat}, vat=${vat}, expected≈${expected}, diff=${diff.toFixed(4)}`,
        );
      }
    };
    for (const t of BUILDING_TABLES) {
      for (const r of t.rows) {
        check(`a${t.advancePct}r${t.retentionPct} costM=${r.costM}`, r.noVat, r.vat);
      }
      check(`a${t.advancePct}r${t.retentionPct} above`, t.above.noVat, t.above.vat);
    }
    expect(
      failures.length,
      'consistency failures:\n' + failures.join('\n'),
    ).toBe(0);
  });
});

// =============================================================================
// D) lookupFactorF คืน verified flag ตรงตาราง
// =============================================================================
describe('Factor F: verified flag passthrough', () => {
  it('a0r0 → verified=true (test-verified)', () => {
    expect(
      lookupFactorF({
        advancePct: 0,
        retentionPct: 0,
        totalDirectCostTHB: 10_000_000,
        includeVAT: false,
      }).verified,
    ).toBe(true);
  });
  it('a0r5 → verified=false', () => {
    expect(
      lookupFactorF({
        advancePct: 0,
        retentionPct: 5,
        totalDirectCostTHB: 10_000_000,
        includeVAT: false,
      }).verified,
    ).toBe(false);
  });
  it('a10r10 → verified=false', () => {
    expect(
      lookupFactorF({
        advancePct: 10,
        retentionPct: 10,
        totalDirectCostTHB: 10_000_000,
        includeVAT: false,
      }).verified,
    ).toBe(false);
  });
  it('a15r10 → verified=false', () => {
    expect(
      lookupFactorF({
        advancePct: 15,
        retentionPct: 10,
        totalDirectCostTHB: 10_000_000,
        includeVAT: false,
      }).verified,
    ).toBe(false);
  });
  it('verified=true มีเพียงตาราง (0,0) ใน BUILDING_TABLES', () => {
    const verified = BUILDING_TABLES.filter((t) => t.verified);
    expect(verified).toHaveLength(1);
    expect(verified[0]!.advancePct).toBe(0);
    expect(verified[0]!.retentionPct).toBe(0);
  });
});

// =============================================================================
// Sanity: schema invariants (rows finite 0.5..500; above present everywhere)
// =============================================================================
describe('Factor F: schema invariants (rows finite + above present)', () => {
  it('every table: rows.length === 23 (0.5..500 ล้านบาท)', () => {
    for (const t of BUILDING_TABLES) {
      expect(t.rows).toHaveLength(23);
    }
  });
  it('every table: rows[0].costM === 0.5 และ rows[last].costM === 500', () => {
    for (const t of BUILDING_TABLES) {
      expect(t.rows[0]!.costM).toBe(0.5);
      expect(t.rows[t.rows.length - 1]!.costM).toBe(500);
    }
  });
  it('every table: rows เรียง asc by costM', () => {
    for (const t of BUILDING_TABLES) {
      for (let i = 1; i < t.rows.length; i++) {
        expect(t.rows[i]!.costM).toBeGreaterThan(t.rows[i - 1]!.costM);
      }
    }
  });
  it('every table: above = { noVat, vat } (ทั้ง 2 ค่า finite > 0)', () => {
    for (const t of BUILDING_TABLES) {
      expect(Number.isFinite(t.above.noVat)).toBe(true);
      expect(Number.isFinite(t.above.vat)).toBe(true);
      expect(t.above.noVat).toBeGreaterThan(0);
      expect(t.above.vat).toBeGreaterThan(0);
    }
  });
});
