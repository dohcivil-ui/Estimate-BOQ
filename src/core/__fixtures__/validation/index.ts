// src/core/__fixtures__/validation/index.ts — typed shapes สำหรับ validation fixtures
// อ้างอิงจาก "รพ.กุสุมาลย์" (Kusumarn Hospital) — ตัวอย่างแบบจริงเพื่อ ground-truth testing
import type { Pt } from '../../geometry';
import type { ScaleSample } from '../../formula';

/** Area-type case (gross polygon → optional opening deductions) */
export type AreaCase = {
  /** ชื่อสั้น เพื่อ debug */
  name: string;
  /** drawing sources ที่อ้างอิง (เช่น 'S-03', 'A-06') */
  sources: string[];
  /** unitPerPixel ของหน้าแบบนี้ (m/canonical-page-pixel) */
  unitPerPixel: number;
  /** จุด 2 จุดที่ใช้ calibrate (ระยะจริง + pixel จาก p1→p2) */
  calib: ScaleSample & { axis: 'x' | 'y' };
  /** จุดอีก 2 จุดบนแกนตั้งฉากที่ใช้ verify scale */
  verifyDist?: ScaleSample & { axis: 'x' | 'y' };
  /** Outer polygon (gross) ใน canonical page-px */
  gross: Pt[];
  /** Openings (หน้าต่าง/ประตู ฯลฯ) ใน canonical page-px — กรณีไม่หัก ใส่ [] */
  openings: Pt[][];
  /** ค่า expected สำหรับ assertion */
  expectedGrossM2: number;
  expectedNetM2: number;
  /** tolerance สำหรับ |diff|/expected (default 0.01 = 1%) */
  tolerance: number;
};

/** Length-type case (polyline ทับ gridline หรือแนวเส้น) */
export type LengthCase = {
  name: string;
  sources: string[];
  unitPerPixel: number;
  calib?: ScaleSample & { axis: 'x' | 'y' };
  polyline: Pt[];
  closed: boolean;
  expectedLengthM: number;
  tolerance: number;
};

/** Fail-type case (anisotropy เกิน threshold → verifyScale ต้อง throw) */
export type FailCase = {
  name: string;
  sources: string[];
  calib: ScaleSample & { axis: 'x' | 'y'; note?: string };
  verifyDist: ScaleSample & { axis: 'x' | 'y'; note?: string };
  /** anisotropy ที่คาดคำนวณได้ (สำหรับเทียบใน test) */
  expectedAnisotropyApprox: number;
  shouldThrow: true;
};

export { case1Footprint } from './case-1';
export { case2WallWithOpening } from './case-2';
export { case3GridlinePolyline } from './case-3';
export { caseFailAnisotropy } from './case-FAIL';
