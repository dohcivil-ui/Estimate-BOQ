import { describe, test, expect } from 'vitest';
import { computeFooting, type FootingSpec } from './footingCompute';

/**
 * ล็อกเลขงานดิน/ทราย ตาม CGD ข้อ 1/2 (rule-14 resolved 7 มิ.ย.2569)
 * - ขุดดิน = หลุมสุทธิ × 1.30 (เดิม +0.50ม.ข้างละ → ถอดแล้ว)
 * - ทรายรอง = geometric × 1.25
 * - lean = geometric (ไม่เผื่อบดอัด)
 * - ถมกลับ = หลุมสุทธิ − solids (ใช้ปริมาตร geometric ทั้งหมด — ทาง A)
 * ฐานทดสอบ: 2.0×2.0×0.30 · ทราย/lean 0.05 · ลึกขุด 1.00 ม. (ระบุตรง)
 *   หลุมสุทธิ = 2×2×1.0 = 4.00 · solids = conc1.20 + sandGeom0.20 + leanGeom0.20 = 1.60
 */
const baseF: FootingSpec = {
  type: 'F-TEST',
  W: 2.0,
  L: 2.0,
  T: 0.3,
  depth: 1.0,
  count: 1,
  sandThk: 0.05,
  leanThk: 0.05,
};

describe('computeFooting — งานดิน/ทราย ตาม CGD (net geometric · เผื่อย้ายไป ปร.4 · backfill geometric)', () => {
  test('ขุดดิน = หลุมสุทธิ net (เดิม ×1.30=5.20 ย้าย ปร.4)', () => {
    // หลุมสุทธิ 2×2×1.00 = 4.00 (geometric ล้วน)
    expect(computeFooting(baseF).excavation_m3).toBeCloseTo(4, 3);
  });

  test('ทรายรอง = net (เดิม ×1.25=0.25 ย้าย ปร.4)', () => {
    // geom 2×2×0.05 = 0.20 (net)
    expect(computeFooting(baseF).sand_m3).toBeCloseTo(0.2, 3);
  });

  test('lean = geometric ล้วน (ไม่เผื่อบดอัด)', () => {
    expect(computeFooting(baseF).lean_m3).toBeCloseTo(0.2, 3);
  });

  test('ถมกลับ = หลุมสุทธิ − solids (geometric) ไม่อิงค่าที่เผื่อแล้ว', () => {
    // 4.00 − 1.20 − 0.20 − 0.20 − 0 = 2.40
    expect(computeFooting(baseF).backfill_m3).toBeCloseTo(2.4, 3);
  });

  test('×N: ปริมาณคูณจำนวนฐานถูกต้อง', () => {
    const q = computeFooting({ ...baseF, count: 2 });
    expect(q.excavation_m3).toBeCloseTo(8, 3);
    expect(q.backfill_m3).toBeCloseTo(4.8, 3);
  });

  test('หลุมพอดี solids (auto depth, ไม่มีตอม่อ) → ถมกลับ ~0 ไม่ติดลบ', () => {
    // depth=0 → auto = T+lean+sand = 0.40 → หลุม 1.60 = solids → backfill 0
    const q = computeFooting({ ...baseF, depth: 0 });
    expect(q.backfill_m3).toBeCloseTo(0, 3);
    expect(q.warnings.some((w) => w.includes('ถมกลับติดลบ'))).toBe(false);
  });
});

describe('computeFooting — ตอม่อ optional rebar (decouple)', () => {
  test('ตอม่อมีมิติแต่ยังไม่ใส่เหล็ก → คอนกรีต/ดิน/depth ครบ · เหล็กตอม่อ 0 + เตือน', () => {
    const q = computeFooting({
      ...baseF,
      depth: 0, // auto = สูงตอม่อ + หนาฐาน + lean + ทราย = 1.0+0.3+0.05+0.05 = 1.40
      pedestal: { type: 'C2', W: 0.3, L: 0.3, H: 1.0 }, // ไม่มี vBars/tie
    });
    expect(q.ped_concrete_m3).toBeCloseTo(0.09, 3); // 0.3×0.3×1.0
    expect(q.excavation_m3).toBeCloseTo(5.6, 2); // 5.60 หลุมสุทธิ net (เดิม ×1.30=7.28 ย้าย ปร.4)
    expect(q.backfill_m3).toBeCloseTo(3.91, 2); // 5.60 − 1.20 − 0.20 − 0.20 − 0.09
    expect(q.rebar_kg).toBe(0); // ไม่มีเหล็กฐาน+ตอม่อ
    expect(q.warnings.some((w) => w.includes('ยังไม่ใส่เหล็ก'))).toBe(true);
  });
});
