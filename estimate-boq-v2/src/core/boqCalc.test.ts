/**
 * Tests สำหรับ effectiveFactorF — round 4dp หลัง interpolate (ปร.5 ราชการ)
 */
import { describe, it, expect } from 'vitest';
import { effectiveFactorF } from './boqCalc';

describe('effectiveFactorF — round 4dp', () => {
  it('baseline ข) สพฐ. ห้องสมุด: 2,335,640 บาท adv=0 ret=0 → 1.3048', () => {
    // bracket 2ล F=1.3051 · bracket 5ล F=1.3020 · step 0.0031
    // ratio = (2.33564 − 2) / 3 = 0.11188 → F = 1.3051 + 0.11188×(−0.0031) = 1.304753172
    // round 4dp → 1.3048
    const f = effectiveFactorF(2_335_640, 0, 0, 0);
    expect(f).toBe(1.3048);
    // พิสูจน์: 2,335,640 × 1.3048 = 3,047,543.072
    expect(2_335_640 * f).toBeCloseTo(3_047_543.072, 3);
  });

  it('baseline ก) 14,489,053.08 บาท adv=0 ret=0 → 1.2647 (CGD 2567 ในระบบ)', () => {
    // bracket 10ล F=1.2960 · bracket 15ล F=1.2611 · step 0.0349
    // ratio = (14.48905308 − 10) / 5 = 0.897810616 → F = 1.2960 + 0.8978×(−0.0349) = 1.264666...
    // round 4dp → 1.2647
    // (หมายเหตุ: ผู้ใช้ระบุ 1.2612 จากตารางคนละชุด — ตารางในระบบนี้ CGD 2567 ให้ค่านี้)
    const f = effectiveFactorF(14_489_053.08, 0, 0, 0);
    expect(f).toBe(1.2647);
  });

  it('property: F ที่ปัดแล้ว = จำนวนเต็ม × 1e-4 (ไม่มีเลขที่ 5+ ทศนิยม)', () => {
    // ทดสอบ interpolation หลายจุดในตาราง
    const samples = [
      [1_500_000, 0, 0],
      [2_500_000, 0, 0],
      [7_500_000, 0, 0],
      [12_500_000, 5, 0],
      [22_000_000, 0, 5],
      [55_000_000, 10, 10],
    ] as const;
    for (const [cost, adv, ret] of samples) {
      const f = effectiveFactorF(cost, 0, adv, ret);
      // x = i/10000 → x × 10000 ต้องเป็นจำนวนเต็ม (มี float artifact เล็กน้อย → ใช้ epsilon)
      const scaled = f * 10000;
      expect(Math.abs(scaled - Math.round(scaled))).toBeLessThan(1e-6);
    }
  });

  it('override: ค่ากรอกเอง > 0 → ใช้ตรงๆ ไม่ปัด (เคารพ user input)', () => {
    expect(effectiveFactorF(5_000_000, 1.23456789, 0, 0)).toBe(1.23456789);
    expect(effectiveFactorF(5_000_000, 1.5, 0, 0)).toBe(1.5);
  });

  it('exact bracket: ค่างาน 5,000,000 บาท (lookup ตรง bracket) ก็ปัด 4dp', () => {
    const f = effectiveFactorF(5_000_000, 0, 0, 0);
    // T_A0_R0 bracket 5ล: 1.3020
    expect(f).toBe(1.3020);
  });
});
