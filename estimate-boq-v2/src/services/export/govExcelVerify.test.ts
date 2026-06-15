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

describe('Factor F flat clamp (ว.499)', () => {
  // ≤0.5M: factorFBracketFor คืน {rangeLow:500000, rangeHigh:1000000, fLow=fHigh=1.3091}
  it('ต้นทุน <500k → ไม่ throw FACTORF_BRACKET + factorF=1.3091', () => {
    const d = structuredClone(ref);
    d.buildingItems[1] = [{ type: 'item', name: 'รวม', qty: 1, unit: 'รวม', matUnit: 58000, laborUnit: 0 }];
    d.factorF = { advanceRate: 0, retentionRate: 0, rangeLow: 500000, rangeHigh: 1000000, fLow: 1.3091, fHigh: 1.3091 };
    const r = verifyBoqInput(d);
    expect(r.issues.some(x => x.code === 'FACTORF_BRACKET')).toBe(false);
    expect(r.expect.factorFCeil).toBe(1.3091);
  });
  // >500M: bracket สุดท้าย {rangeLow:500000000, rangeHigh:9999000000, fLow=fHigh=1.1805}
  // (ขอบบนแทบไม่ trip guard จริงเพราะ rangeHigh=9999M — เทสต์นี้ยืนยันค่า clamp = 1.1805 เป็นหลัก)
  it('ต้นทุน >500M → ไม่ throw + factorF=1.1805', () => {
    const d = structuredClone(ref);
    d.buildingItems[1] = [{ type: 'item', name: 'รวม', qty: 1, unit: 'รวม', matUnit: 600000000, laborUnit: 0 }];
    d.factorF = { advanceRate: 0, retentionRate: 0, rangeLow: 500000000, rangeHigh: 9999000000, fLow: 1.1805, fHigh: 1.1805 };
    const r = verifyBoqInput(d);
    expect(r.issues.some(x => x.code === 'FACTORF_BRACKET')).toBe(false);
    expect(r.expect.factorFCeil).toBe(1.1805);
  });
});
