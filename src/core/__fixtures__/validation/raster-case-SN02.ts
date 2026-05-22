// src/core/__fixtures__/validation/raster-case-SN02.ts
// ===========================================================================
// REAL-GATE case — รพ.กุสุมาลย์ SN-02 (Sanitary floor plan)
// (เลือก SN-02 เพราะเป็น floor plan ที่มี grid + dimension string ครบ)
//
// แหล่งที่มา (PDF): hemodyalysis_Electric_and_Sanitary_.pdf (ยังไม่อยู่ใน working dir)
//
// SCOPE ของ case นี้ = ตรวจ **scale + grid envelope** (สูตร upp² × shoelace)
//   - footprintPx = 4 จุด **grid intersection** (1A, 6A, 6C, 1C)
//   - **ไม่ใช่มุมผนัง** — กรอบ grid ใช้ตรวจว่า scale ถูก + perpendicularity ตรง
//   - expectedAreaM2 = 26.00 × 14.00 = 364.00 m² (grid envelope)
//   - ไม่ใช่พื้นที่ห้อง/อาคารจริง (พื้นที่จริงต้องหักผนัง/openings — กรณีอื่น)
//
// ขั้นตอนการเปิดใช้ test นี้ (ดู raster/README.md):
//   1. rasterize PDF → ครอป → raster/SN-02.png ที่ DPI 200
//   2. คำนวณ sha256 → เติม `imageSha256`
//   3. วัด px ของ 4 grid intersection (1A/6A/6C/1C) + calib + verify spans
//   4. รัน `npm run test:math` — formula.realgate.test.ts จะ activate อัตโนมัติ
// ===========================================================================
import type { RasterMeasuredCase } from './raster-types';

export const caseSN02Raster: RasterMeasuredCase = {
  sourceSheet: 'SN-02',
  imageFile: 'SN-02.png',
  /** TODO(stage-a): เติม sha256 หลัง rasterize → `sha256sum SN-02.png` (Linux/macOS) หรือ
   *  `CertUtil -hashfile SN-02.png SHA256` (Windows) */
  imageSha256: null,
  /** DPI คงที่ทั้ง project — ห้ามเปลี่ยนระหว่าง case (จะทำให้ sha256 + px เปลี่ยนหมด) */
  renderDpi: 200,

  /**
   * Calibration: ใช้ระยะ "grid 1 → grid 6" แนวยาวอาคาร = **26.00 m**
   * (อ่านจาก dim string ระหว่าง grid 1 กับ grid 6 — ห้ามใช้ overall 28.00
   *  ที่อาจรวม cantilever/canopy นอกกรอบ grid)
   */
  calib: {
    aPx: null, // TODO(stage-a): pixel coord ของ grid intersection 1A (หรือกึ่งกลาง grid 1)
    bPx: null, // TODO(stage-a): pixel coord ของ grid intersection 6A (หรือกึ่งกลาง grid 6)
    realM: 26.0,
    note: 'grid 1→6 (แนวยาว) — ห้ามใช้ overall dim 28.00; ต้องเป็นระยะ grid-to-grid',
  },

  /**
   * Verification: ใช้ระยะ "grid A → grid C" แนวสั้นอาคาร = **14.00 m**
   * (แกนตั้งฉากกับ calib — ใช้ verifyScale ตรวจ anisotropy ≤ 1%)
   */
  verify: {
    aPx: null, // TODO(stage-a): pixel coord ของ grid intersection 1A
    bPx: null, // TODO(stage-a): pixel coord ของ grid intersection 1C
    realM: 14.0,
    note: 'grid A→C (แนวสั้น) — verify isotropy',
  },

  /**
   * Grid-envelope polygon — **4 จุด grid intersection** (ไม่ใช่มุมผนัง)
   * clockwise: 1A (top-left) → 6A (top-right) → 6C (bottom-right) → 1C (bottom-left)
   * shoelace area บนกรอบนี้ = 26.00 × 14.00 = 364.00 m² (envelope)
   */
  footprintPx: null, // TODO(stage-a): [1A, 6A, 6C, 1C] เป็น Pt[] ใน raster px

  /** expected = grid envelope area = 26.00 × 14.00 = 364.00 m² */
  expectedAreaM2: 364.0,
  tolerance: 0.01,

  references: [
    'dim string: grid 1→6 = 26.00 m (แนวยาว) ; ห้ามใช้ overall 28.00 (รวม cantilever)',
    'dim string: grid A→C = 14.00 m (แนวสั้น)',
    'footprintPx = grid envelope 1A/6A/6C/1C — ตรวจ scale + perpendicularity',
    'matches synthetic case-1 (S-03/A-06) — เป็น geometric-gate counterpart',
  ],
};
