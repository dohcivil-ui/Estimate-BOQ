// CASE-3 — รพ.กุสุมาลย์ Polyline length ทับ gridline (SN-02)
// ===========================================================================
// แบบ: polyline ทับแนว gridline (เช่น แนว wall centerline หรือแนว grid)
//   ระยะจริงรวม = 14.00 m (จากแบบ SN-02)
//   ทดสอบ lengthPolyline (closed=false) เทียบกับค่าจริง ±1%
//
// Canonical canvas — scale 50 px/m (upp = 0.02):
//   total = 700 px (= 14.00 m)
//   แบ่งเป็น 3 segment: 250 + 250 + 200 = 700 px → 5.00 + 5.00 + 4.00 = 14.00 m
//   (เลือกหลาย segment เพื่อทดสอบ polyline ไม่ใช่ line 2 จุด)
// ===========================================================================
import type { Pt } from '../../geometry';
import type { LengthCase } from './index';

const UPP = 0.02; // m/px

const polyline: Pt[] = [
  { x: 0, y: 0 },
  { x: 250, y: 0 }, // segment 1: 250 px = 5.00 m
  { x: 250, y: 250 }, // segment 2: 250 px = 5.00 m
  { x: 50, y: 250 }, // segment 3: 200 px = 4.00 m
];

export const case3GridlinePolyline: LengthCase = {
  name: 'case-3: polyline 14.00 m ทับ gridline (รพ.กุสุมาลย์ SN-02)',
  sources: ['SN-02'],
  unitPerPixel: UPP,
  calib: { axis: 'x', realDistance: 5.0, pixelDistance: 250 },
  polyline,
  closed: false,
  expectedLengthM: 14.0,
  tolerance: 0.01,
};
