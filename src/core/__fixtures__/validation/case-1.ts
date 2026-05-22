// CASE-1 — รพ.กุสุมาลย์ Building footprint (S-03 / A-06)
// ===========================================================================
// แบบ: ตึกผังสี่เหลี่ยม 26.00 m × 14.00 m (footprint ภายนอก)
// Calibrate: ทับขอบยาว แกน x = 26.00 m
// Verify   : ทับขอบสั้น แกน y = 14.00 m  (ต้องได้ upp เดียวกัน)
// Expected : gross area = 26 × 14 = 364.00 m² ; ไม่หักช่อง → net = gross
//
// Canonical canvas — เลือก scale 50 px/m (upp = 0.02 m/px) ให้ตัวเลขสะอาด:
//   26.00 m → 1300 px (แกน x)
//   14.00 m →  700 px (แกน y)
//   footprint polygon = สี่เหลี่ยม 1300 × 700 px
// ===========================================================================
import type { Pt } from '../../geometry';
import type { AreaCase } from './index';

const UPP = 0.02; // m/px (50 px/m drawing scale)

const corners: Pt[] = [
  { x: 100, y: 500 }, // top-left
  { x: 1400, y: 500 }, // top-right  (Δx = 1300 px = 26.00 m)
  { x: 1400, y: 1200 }, // bottom-right (Δy = 700 px = 14.00 m)
  { x: 100, y: 1200 }, // bottom-left
];

export const case1Footprint: AreaCase = {
  name: 'case-1: footprint 26.00×14.00 (รพ.กุสุมาลย์)',
  sources: ['S-03', 'A-06'],
  unitPerPixel: UPP,
  calib: { axis: 'x', realDistance: 26.0, pixelDistance: 1300 },
  verifyDist: { axis: 'y', realDistance: 14.0, pixelDistance: 700 },
  gross: corners,
  openings: [],
  expectedGrossM2: 364.0,
  expectedNetM2: 364.0,
  tolerance: 0.01,
};
