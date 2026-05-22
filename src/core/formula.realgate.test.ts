// src/core/formula.realgate.test.ts
// ===========================================================================
// REAL-GATE — geometric gate ±1% เทียบกับแบบจริง (raster-measured)
// แตกต่างจาก formula.validation.test.ts ที่เป็น exact-by-construction:
//   ที่นี่ "ผ่าน" ก็ต่อเมื่อระยะที่วัดจาก raster พลาดจากค่าจริง ≤ 1%
//
// สถานะ: ทุกเคสเป็น `it.todo()` จนกว่า:
//   1. PNG ถูก rasterize แล้ววางใน ./__fixtures__/validation/raster/
//   2. imageSha256 ถูกเติมใน fixture
//   3. ทุก px field (calib.aPx, calib.bPx, verify.aPx, verify.bPx, footprintPx) ถูกเติม
// เมื่อครบ → conditional dispatch จะปลดล็อก test เป็น `it()` จริงอัตโนมัติ
//
// **ห้ามแก้ formula.ts** จาก gate นี้ — ถ้า assertion ไม่ผ่าน:
//   - calib/verify/footprint อ่าน px ผิด → human re-measure
//   - scan เอียง/แบบไม่ to-scale → finding (log, แก้ raster ต้นทาง) — ห้ามลด threshold
// ===========================================================================
import { describe, it, expect } from 'vitest';
import { netArea, lengthPolyline, verifyScale } from './formula';
import {
  caseSN02Raster,
} from './__fixtures__/validation/raster-case-SN02';
import {
  isPxReady,
  type RasterMeasuredCase,
} from './__fixtures__/validation/raster-types';
import { verifyRasterCase } from './__fixtures__/validation/raster-test-utils';

function withinTolerance(actual: number, expected: number, tol: number): boolean {
  if (expected === 0) return Math.abs(actual) <= tol;
  return Math.abs(actual - expected) / Math.abs(expected) <= tol;
}

function pixelDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** ตัว wrapper: ถ้า px ยังไม่ครบ → it.todo() ทุกเคสในกลุ่ม */
function runRealGate(c: RasterMeasuredCase) {
  const ready = isPxReady(c);

  describe(`REAL-GATE — ${c.sourceSheet} ${ready ? '(active)' : '(awaiting raster + px measurements)'}`, () => {
    if (!ready) {
      // ทุก test เป็น .todo จนกว่ามนุษย์จะเติม px (และ sha256)
      it.todo(`[${c.sourceSheet}] sha256 ของ PNG ต้องตรงกับที่ commit (verifyRasterCase)`);
      it.todo(
        `[${c.sourceSheet}] verifyScale(calib, verify) ต้องไม่ throw — anisotropy ≤ 1% (ถ้า throw = scan เอียง, log เป็น finding ห้ามลด threshold)`,
      );
      it.todo(
        `[${c.sourceSheet}] netArea(footprintPx, [], upp) ≈ ${c.expectedAreaM2} m² (±${(c.tolerance * 100).toFixed(0)}%)`,
      );
      it.todo(
        `[${c.sourceSheet}] lengthPolyline([verify span], upp) ≈ ${c.verify.realM} m (±${(c.tolerance * 100).toFixed(0)}%)`,
      );
      return;
    }

    // -------- px ครบแล้ว → รัน assertion จริง --------
    it(`[${c.sourceSheet}] sha256 ของ PNG ตรงกับที่ commit`, () => {
      // throw ถ้า PNG หาย / sha mismatch / sha ยังเป็น null
      expect(() => verifyRasterCase(c)).not.toThrow();
    });

    it(`[${c.sourceSheet}] verifyScale ไม่ throw + anisotropy ≤ 1%`, () => {
      const calibPx = pixelDistance(c.calib.aPx!, c.calib.bPx!);
      const verifyPx = pixelDistance(c.verify.aPx!, c.verify.bPx!);
      const { anisotropy } = verifyScale(
        { realDistance: c.calib.realM, pixelDistance: calibPx },
        { realDistance: c.verify.realM, pixelDistance: verifyPx },
      );
      expect(anisotropy).toBeLessThanOrEqual(0.01);
    });

    it(`[${c.sourceSheet}] netArea(footprint, []) ≈ ${c.expectedAreaM2} m² (±${(c.tolerance * 100).toFixed(0)}%)`, () => {
      const calibPx = pixelDistance(c.calib.aPx!, c.calib.bPx!);
      const upp = c.calib.realM / calibPx;
      const net = netArea(c.footprintPx!, [], upp);
      expect(withinTolerance(net, c.expectedAreaM2, c.tolerance)).toBe(true);
    });

    it(`[${c.sourceSheet}] lengthPolyline(verify span) ≈ ${c.verify.realM} m (±${(c.tolerance * 100).toFixed(0)}%)`, () => {
      const calibPx = pixelDistance(c.calib.aPx!, c.calib.bPx!);
      const upp = c.calib.realM / calibPx;
      const len = lengthPolyline([c.verify.aPx!, c.verify.bPx!], upp, false);
      expect(withinTolerance(len, c.verify.realM, c.tolerance)).toBe(true);
    });
  });
}

runRealGate(caseSN02Raster);
