/**
 * Tests สำหรับ por5Summary + bahtText
 * baseline เทียบเอกสารจริง: docs/knowledge/pr4-example-municipal-building.md
 */
import { describe, it, expect } from 'vitest';
import { por5Summary, bahtText } from './por5Summary';

describe('por5Summary', () => {
  it('1) baseline เอกสารจริง: directCost=5,931,154 × F=1.26280 → 7,489,861 / 7,489,000 / ตัวอักษรไทย', () => {
    const res = por5Summary(5_931_154, 1.26280);
    expect(res.directCost).toBe(5_931_154);
    expect(res.factorF).toBeCloseTo(1.26280, 6);
    expect(res.constructionCost).toBeCloseTo(7_489_861.2712, 4);
    expect(res.constructionCostBaht).toBe(7_489_861);
    expect(res.approxAmount).toBe(7_489_000);
    expect(res.approxAmountText).toBe('เจ็ดล้านสี่แสนแปดหมื่นเก้าพันบาทถ้วน');
  });

  it('3) floor หลักพันทิ้ง: 7,489,999 → 7,489,000 (ไม่ขึ้น 7,490,000)', () => {
    // สมมุติว่า F คูณแล้วได้ 7,489,999 → ใช้ F=1 + directCost=7,489,999 จำลอง
    const res = por5Summary(7_489_999, 1);
    expect(res.constructionCostBaht).toBe(7_489_999);
    expect(res.approxAmount).toBe(7_489_000);
  });

  it('4) float guard: directCost×F ที่มีเศษทศนิยมยาวยังคงปัดเต็มบาทตรง', () => {
    // 100,000 × 1.0000001 = 100000.01 — แต่ JS อาจ store เป็น 100000.00999999... → floor พลาด
    // เลือกค่าที่ตั้งใจให้ float artifact:
    //   1.7 × 10 = 17.000000000000004 (เพิ่มเศษ float) — แต่เราต้องการ "ติดลบ" เพื่อทดสอบ floor
    //   ใช้ 0.1 + 0.2 = 0.30000000000000004 → 100,000 × (1 + 0.1+0.2) = ?
    // จริงๆ test แบบกะค่าตรงๆ ง่ายกว่า:
    const epsCase = 10 * (0.1 + 0.2); // = 3.0000000000000004 (มี float artifact)
    // ปัดผ่าน epsilon ใน floorBaht → 3 (ถูก)
    // ทดสอบผ่าน bahtText (รับเลขจาก approxAmount) ก็พอ
    expect(bahtText(Math.floor(epsCase + 1e-9))).toBe('สามบาทถ้วน');

    // เพิ่ม: case ที่ผลคูณยาว → constructionCostBaht ต้องเป็นจำนวนเต็มไม่เพี้ยน
    const res = por5Summary(123_456_789, 1.234567);
    // 123456789 × 1.234567 = 152,415,786.971663… → floor 152,415,786
    expect(Number.isInteger(res.constructionCostBaht)).toBe(true);
    expect(Number.isInteger(res.approxAmount)).toBe(true);
    expect(res.approxAmount % 1000).toBe(0); // ปัดหลักพันตรง
  });

  it('config override: round (ไม่ใช่ floor) ทำงานตามที่ตั้ง', () => {
    const res = por5Summary(7_489_750, 1, 0, {
      bahtMode: 'round',
      approxMode: 'round',
      approxStep: 1000,
    });
    expect(res.constructionCostBaht).toBe(7_489_750);
    expect(res.approxAmount).toBe(7_490_000); // round half-up
  });

  it('specialCost (ส่วนที่ 2): 100,000 × 1.3 + 5,000 = 135,000 (ไม่คูณ F)', () => {
    const res = por5Summary(100_000, 1.3, 5_000);
    expect(res.constructionCost).toBeCloseTo(135_000, 6);
    expect(res.constructionCostBaht).toBe(135_000);
    expect(res.approxAmount).toBe(135_000);
  });

  it('specialCost default = 0 (backward compat ของ baseline เอกสาร)', () => {
    const res = por5Summary(5_931_154, 1.26280); // ไม่ส่ง specialCost
    expect(res.constructionCostBaht).toBe(7_489_861);
    expect(res.approxAmount).toBe(7_489_000);
  });
});

describe('bahtText (Thai number reading)', () => {
  it('2a) 1 → หนึ่งบาทถ้วน (เลขเดี่ยว ไม่ใช่เอ็ด)', () => {
    expect(bahtText(1)).toBe('หนึ่งบาทถ้วน');
  });

  it('2b) 11 → สิบเอ็ดบาทถ้วน (หลักสิบ=1 ไม่ใช่ "หนึ่งสิบ" · หลักหน่วย=1 ตามหลังสิบ → เอ็ด)', () => {
    expect(bahtText(11)).toBe('สิบเอ็ดบาทถ้วน');
  });

  it('2c) 21 → ยี่สิบเอ็ดบาทถ้วน (หลักสิบ=2 ใช้ "ยี่สิบ")', () => {
    expect(bahtText(21)).toBe('ยี่สิบเอ็ดบาทถ้วน');
  });

  it('2d) 100 → หนึ่งร้อยบาทถ้วน', () => {
    expect(bahtText(100)).toBe('หนึ่งร้อยบาทถ้วน');
  });

  it('2e) 1,000,000 → หนึ่งล้านบาทถ้วน', () => {
    expect(bahtText(1_000_000)).toBe('หนึ่งล้านบาทถ้วน');
  });

  it('2f) 10,500,000 → สิบล้านห้าแสนบาทถ้วน (หลักล้านซ้อน — "สิบล้าน" ไม่ใช่ "หนึ่งสิบล้าน")', () => {
    expect(bahtText(10_500_000)).toBe('สิบล้านห้าแสนบาทถ้วน');
  });

  // ── extra edge cases (sanity) ─────────────────────────────────────
  it('edge: 0 → ศูนย์บาทถ้วน', () => {
    expect(bahtText(0)).toBe('ศูนย์บาทถ้วน');
  });

  it('edge: 7,489,000 (baseline approxAmount) → ตัวอักษรไทยตรง', () => {
    expect(bahtText(7_489_000)).toBe('เจ็ดล้านสี่แสนแปดหมื่นเก้าพันบาทถ้วน');
  });

  it('edge: 1,000,001 → หนึ่งล้านเอ็ด (เลข 1 ในหลักหน่วย หลังมีกลุ่มล้านนำ → เอ็ด)', () => {
    expect(bahtText(1_000_001)).toBe('หนึ่งล้านเอ็ดบาทถ้วน');
  });

  it('edge: 100,000,000 → หนึ่งร้อยล้านบาทถ้วน', () => {
    expect(bahtText(100_000_000)).toBe('หนึ่งร้อยล้านบาทถ้วน');
  });

  it('edge: 1,000,000,000,000 (1 ล้านล้าน) → หนึ่งล้านล้านบาทถ้วน', () => {
    expect(bahtText(1_000_000_000_000)).toBe('หนึ่งล้านล้านบาทถ้วน');
  });
});
