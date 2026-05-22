// src/core/formula.validation.test.ts
// ===========================================================================
// Ground-truth validation: ใช้ fixture ที่ดึงมาจากแบบจริง (รพ.กุสุมาลย์)
// เพื่อยืนยันว่า formula.ts คำนวณค่า "ใกล้ค่าจริง" ภายใน 1%
// — ผ่าน fn เดิม (polygonQuantity / netArea / lengthPolyline / verifyScale)
// — ห้าม inline สูตรใน test (Golden Rule #3)
// ===========================================================================
import { describe, it, expect } from 'vitest';
import {
  polygonQuantity,
  netArea,
  lengthPolyline,
  verifyScale,
} from './formula';
import {
  case1Footprint,
  case2WallWithOpening,
  case3GridlinePolyline,
  caseFailAnisotropy,
} from './__fixtures__/validation';

/** ตรวจ |actual − expected| / expected ≤ tol */
function withinTolerance(actual: number, expected: number, tol: number): boolean {
  if (expected === 0) return Math.abs(actual) <= tol;
  return Math.abs(actual - expected) / Math.abs(expected) <= tol;
}

describe('CASE-1 — รพ.กุสุมาลย์ footprint 26×14 (S-03/A-06)', () => {
  const c = case1Footprint;

  it('verifyScale: calib x=26 + verify y=14 → anisotropy ≈ 0 (ไม่ throw)', () => {
    expect(c.verifyDist).toBeDefined();
    const { anisotropy } = verifyScale(c.calib, c.verifyDist!);
    expect(anisotropy).toBeLessThanOrEqual(0.01);
    expect(anisotropy).toBeCloseTo(0, 6);
  });

  it('gross area ≈ 364.00 m² (±1%)', () => {
    const gross = polygonQuantity(c.gross, c.unitPerPixel);
    expect(withinTolerance(gross, c.expectedGrossM2, c.tolerance)).toBe(true);
  });

  it('net area = gross (ไม่หักช่อง) ≈ 364.00 m² (±1%)', () => {
    const net = netArea(
      c.gross,
      c.openings.map((points) => ({ points })),
      c.unitPerPixel,
    );
    expect(withinTolerance(net, c.expectedNetM2, c.tolerance)).toBe(true);
  });
});

describe('CASE-2 — รพ.กุสุมาลย์ ผนัง + Fix 4.00×2.50 (A-08)', () => {
  const c = case2WallWithOpening;

  it('verifyScale (8.00 × 3.00) → isotropic (ไม่ throw)', () => {
    expect(c.verifyDist).toBeDefined();
    const { anisotropy } = verifyScale(c.calib, c.verifyDist!);
    expect(anisotropy).toBeLessThanOrEqual(0.01);
  });

  it('gross ≈ 24.00 m² (±1%)', () => {
    const gross = polygonQuantity(c.gross, c.unitPerPixel);
    expect(withinTolerance(gross, c.expectedGrossM2, c.tolerance)).toBe(true);
  });

  it('net (หักหน้าต่าง Fix 10.00 m² ผ่าน threshold 0.5) ≈ 14.00 m² (±1%)', () => {
    const net = netArea(
      c.gross,
      c.openings.map((points) => ({ points })),
      c.unitPerPixel,
      /* thresholdM2 */ 0.5,
    );
    expect(withinTolerance(net, c.expectedNetM2, c.tolerance)).toBe(true);
  });

  it('threshold สูงกว่า opening (เช่น 20 m²) → ไม่หัก, net = gross', () => {
    const net = netArea(
      c.gross,
      c.openings.map((points) => ({ points })),
      c.unitPerPixel,
      20, // > 10 m² ของ window
    );
    expect(withinTolerance(net, c.expectedGrossM2, c.tolerance)).toBe(true);
  });
});

describe('CASE-3 — รพ.กุสุมาลย์ polyline ทับ gridline 14.00 m (SN-02)', () => {
  const c = case3GridlinePolyline;

  it('lengthPolyline (closed=false) ≈ 14.00 m (±1%)', () => {
    const len = lengthPolyline(c.polyline, c.unitPerPixel, c.closed);
    expect(withinTolerance(len, c.expectedLengthM, c.tolerance)).toBe(true);
  });

  it('lengthPolyline (closed=true) เพิ่ม segment ปิด last→first', () => {
    const open = lengthPolyline(c.polyline, c.unitPerPixel, false);
    const closed = lengthPolyline(c.polyline, c.unitPerPixel, true);
    expect(closed).toBeGreaterThan(open);
  });

  it('จุด < 2 → คืน 0 (degenerate)', () => {
    expect(lengthPolyline([], c.unitPerPixel, false)).toBe(0);
    expect(lengthPolyline([{ x: 1, y: 1 }], c.unitPerPixel, false)).toBe(0);
  });
});

describe('CASE-FAIL — anisotropy ~7.7% (calib x mis-read 28.00 m)', () => {
  const c = caseFailAnisotropy;

  it('verifyScale ต้อง throw — ห้าม auto-correct (fail loud)', () => {
    expect(() => verifyScale(c.calib, c.verifyDist)).toThrow(/anisotropy/);
  });

  it('throw message ต้องมีตัวเลข % เกินกว่า 1% (อ่านได้ว่าเกินเท่าไร)', () => {
    expect(() => verifyScale(c.calib, c.verifyDist)).toThrow(/[1-9]\.\d{2}%/);
  });

  it('expected anisotropy ≈ 0.0769 (ตรงกับ |28/26 − 1| สำหรับ ratio แกน)', () => {
    // คำนวณซ้ำใน test (ไม่ใช่ inline สูตรของ formula — แค่ตรวจค่าที่คาด)
    const calibUpp = c.calib.realDistance / c.calib.pixelDistance;
    const verifyUpp = c.verifyDist.realDistance / c.verifyDist.pixelDistance;
    const aniso = Math.abs(calibUpp / verifyUpp - 1);
    expect(aniso).toBeCloseTo(c.expectedAnisotropyApprox, 3);
  });
});

describe('verifyScale input guards', () => {
  it('pixelDistance = 0 → throw', () => {
    expect(() =>
      verifyScale(
        { realDistance: 1, pixelDistance: 0 },
        { realDistance: 1, pixelDistance: 1 },
      ),
    ).toThrow();
  });
  it('realDistance ลบ → throw', () => {
    expect(() =>
      verifyScale(
        { realDistance: -1, pixelDistance: 1 },
        { realDistance: 1, pixelDistance: 1 },
      ),
    ).toThrow();
  });
});
