// CASE-2 — รพ.กุสุมาลย์ Wall + Fixed window deduction (A-08)
// ===========================================================================
// แบบ: ผนังภายนอกพร้อมหน้าต่าง Fix
//   ผนัง (gross outline)  = 8.00 m × 3.00 m  =  24.00 m²
//   หน้าต่าง Fix (opening) = 4.00 m × 2.50 m =  10.00 m²
//   net (ผนังก่อจริง)      = 24.00 − 10.00   =  14.00 m²
//
// deductsOpenings = true; thresholdM2 = 0.5 (default) — opening 10.0 m² ผ่าน threshold
//
// Canonical canvas — scale เดิม 50 px/m (upp = 0.02):
//   wall   = 400 × 150 px
//   window = 200 × 125 px (centered within wall)
// ===========================================================================
import type { Pt } from '../../geometry';
import type { AreaCase } from './index';

const UPP = 0.02; // m/px

// ผนัง: rectangle (0,0)→(400,150) shifted ไปกลางแบบกัน vertex อยู่ที่ origin
const wallTL = { x: 100, y: 100 };
const wallW = 400;
const wallH = 150;

const wallPolygon: Pt[] = [
  { x: wallTL.x, y: wallTL.y },
  { x: wallTL.x + wallW, y: wallTL.y },
  { x: wallTL.x + wallW, y: wallTL.y + wallH },
  { x: wallTL.x, y: wallTL.y + wallH },
];

// หน้าต่าง: 200 × 125 px ตรงกลางผนัง
const winW = 200;
const winH = 125;
const winTL = {
  x: wallTL.x + (wallW - winW) / 2,
  y: wallTL.y + (wallH - winH) / 2,
};
const windowPolygon: Pt[] = [
  { x: winTL.x, y: winTL.y },
  { x: winTL.x + winW, y: winTL.y },
  { x: winTL.x + winW, y: winTL.y + winH },
  { x: winTL.x, y: winTL.y + winH },
];

export const case2WallWithOpening: AreaCase = {
  name: 'case-2: wall+Fix window 4.00×2.50 (รพ.กุสุมาลย์ A-08)',
  sources: ['A-08'],
  unitPerPixel: UPP,
  // ผนัง 8.00 m × 3.00 m → calibrate ด้าน 8.00 m
  calib: { axis: 'x', realDistance: 8.0, pixelDistance: wallW },
  // verify ด้าน 3.00 m
  verifyDist: { axis: 'y', realDistance: 3.0, pixelDistance: wallH },
  gross: wallPolygon,
  openings: [windowPolygon],
  expectedGrossM2: 24.0,
  expectedNetM2: 14.0,
  tolerance: 0.01,
};
