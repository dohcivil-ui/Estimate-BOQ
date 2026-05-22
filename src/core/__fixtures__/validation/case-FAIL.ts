// CASE-FAIL — Anisotropy ตรวจจับแบบที่ไม่ to-scale (verifyScale ต้อง throw)
// ===========================================================================
// สถานการณ์: ผู้ใช้คลิก 2 จุดบนแกน x ระยะ 1300 px แต่ "กรอกผิด" เป็น 28.00 m
//             (ระยะจริงควรเป็น 26.00 m — เลขรวมผิดเพราะอ่าน dim string ผิด)
// ผู้ใช้ verify บนแกน y ระยะ 700 px = 14.00 m (ถูกต้อง)
//
// ผลที่ formula.verifyScale ต้องคำนวณ:
//   calibUpp  = 28.00 / 1300 ≈ 0.0215385 m/px
//   verifyUpp = 14.00 /  700 = 0.0200000 m/px
//   ratio     = 0.0215385 / 0.02 = 1.07692…
//   anisotropy = |ratio − 1| ≈ 0.07692  (~ 7.69%)
//
// 7.69% > 1% threshold → ต้อง throw (fail loud) — ห้าม auto-correct
// ===========================================================================
import type { FailCase } from './index';

export const caseFailAnisotropy: FailCase = {
  name: 'case-FAIL: anisotropy ~7.7% (calib x mis-read 28.00 m)',
  sources: ['synthetic — เพื่อตรวจ verifyScale ทำงาน'],
  calib: {
    axis: 'x',
    realDistance: 28.0, // ❌ user กรอกผิด (จริง = 26.00)
    pixelDistance: 1300,
    note: 'mis-read dim string เป็น 28 (ต้องเป็น 26)',
  },
  verifyDist: {
    axis: 'y',
    realDistance: 14.0, // ✓
    pixelDistance: 700,
    note: 'ถูกต้อง',
  },
  expectedAnisotropyApprox: 0.0769,
  shouldThrow: true,
};
