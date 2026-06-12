import { describe, it, expect } from 'vitest';
import { verifyBoqInput } from './govExcelVerify';
import type { BoqExportData } from './govExcelExport';

// baseline: อาคารเรียน 324 ล./55-ข (PDF ราชการ = ground truth)
const ref: BoqExportData = {
  meta: { projectName: 'x', location: 'x', province: 'เชียงใหม่' },
  buildingItems: {
    1: [{ type: 'sub', name: '1.1' }, { type: 'item', name: 'รวมต้นทุนอาคาร', qty: 1, unit: 'รวม', matUnit: 9646704.5, laborUnit: 0 }],
    2: [], 3: [], 4: [], 5: [],
  },
  equipmentItems: [{ type: 'item', name: 'ครุภัณฑ์', qty: 1, unit: 'รวม', matUnit: 1339200, laborUnit: 0 }],
  factorF: { advanceRate: 0, retentionRate: 0, rangeLow: 5000000, rangeHigh: 10000000, fLow: 1.302, fHigh: 1.296 },
  conditions: { vat: 0.07, equipmentVat: 0.07 },
};

describe('verifyBoqInput — baseline ตรง PDF', () => {
  const r = verifyBoqInput(ref);
  it('ไม่มี error', () => expect(r.ok).toBe(true));
  it('ค่างานต้นทุน', () => expect(r.expect.buildingNet).toBe(9646704.5));
  it('Factor F ceil = 1.2965 (PDF), floor = 1.2964 (master)', () => {
    expect(r.expect.factorFCeil).toBe(1.2965);
    expect(r.expect.factorFFloor).toBe(1.2964);
  });
  it('ปร.5ก gross/net', () => {
    expect(r.expect.por5kGross).toBe(12506952.38);
    expect(r.expect.por5kNet).toBe(12506000);
  });
  it('ปร.5ข net (floor-พัน)', () => expect(r.expect.por5khNet).toBe(1432000));
  it('ปร.6 = 13,938,000', () => expect(r.expect.por6Total).toBe(13938000));
});

describe('guards', () => {
  it('SLOT_OVERFLOW', () => {
    const d = structuredClone(ref);
    d.buildingItems[1] = Array.from({ length: 99 }, (_, i) => ({ type: 'item', name: `i${i}`, qty: 1, unit: 'x', matUnit: 1, laborUnit: 0 }));
    expect(verifyBoqInput(d).issues.some(x => x.code === 'SLOT_OVERFLOW')).toBe(true);
  });
  it('FACTORF_BRACKET', () => {
    const d = structuredClone(ref);
    d.factorF = { ...d.factorF, rangeLow: 1000000, rangeHigh: 2000000 };
    expect(verifyBoqInput(d).issues.some(x => x.code === 'FACTORF_BRACKET')).toBe(true);
  });
});
