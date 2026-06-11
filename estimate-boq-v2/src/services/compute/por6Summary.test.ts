/**
 * Tests สำหรับ por6Summary — 2 baseline จริงจากเอกสาร สพฐ.
 */
import { describe, it, expect } from 'vitest';
import { por6Summary } from './por6Summary';

describe('por6Summary', () => {
  it('baseline ก) สพฐ. 212ล: [18,273,000, 716,000, 0] → 18,989,000', () => {
    const res = por6Summary([
      { label: 'ค่าก่อสร้างอาคาร', netAmount: 18_273_000 },
      { label: 'ครุภัณฑ์จัดซื้อ', netAmount: 716_000 },
      { label: 'ส่วนที่ 3', netAmount: 0 },
    ]);
    expect(res.total).toBe(18_989_000);
    expect(res.totalText).toBe('สิบแปดล้านเก้าแสนแปดหมื่นเก้าพันบาทถ้วน');
  });

  it('baseline ข) ห้องสมุด: [3,047,000, 482,900, 0] → 3,529,900 (ทดสอบ bahtText ระดับร้อย)', () => {
    const res = por6Summary([
      { label: 'ค่าก่อสร้างอาคาร', netAmount: 3_047_000 },
      { label: 'ครุภัณฑ์จัดซื้อ', netAmount: 482_900 },
      { label: 'ส่วนที่ 3', netAmount: 0 },
    ]);
    expect(res.total).toBe(3_529_900);
    expect(res.totalText).toBe(
      'สามล้านห้าแสนสองหมื่นเก้าพันเก้าร้อยบาทถ้วน',
    );
  });

  it('ไม่ปัดซ้ำ: parts เก็บค่าจริง รวมแล้วต้องตรง', () => {
    // ถ้าใส่จำนวนเต็มเป็นปัดมาแล้ว → ผลรวมยังจำนวนเต็มไม่เพี้ยน
    const res = por6Summary([
      { label: 'A', netAmount: 1_234_567 },
      { label: 'B', netAmount: 89_012 },
    ]);
    expect(res.total).toBe(1_323_579);
    expect(Number.isInteger(res.total)).toBe(true);
  });

  it('empty parts → total 0 / "ศูนย์บาทถ้วน"', () => {
    const res = por6Summary([]);
    expect(res.total).toBe(0);
    expect(res.totalText).toBe('ศูนย์บาทถ้วน');
  });
});
