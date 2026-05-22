// src/core/__fixtures__/validation/raster-types.ts
// ===========================================================================
// RasterMeasuredCase — fixture shape สำหรับ "geometric gate" (raster-measured ±1%)
//
// ไฟล์นี้เป็น **pure data + types** (ไม่มี node:* / browser-only imports)
// → ปลอดภัยที่จะ import จากที่ไหนก็ได้ (รวมถึง production bundle ในอนาคต)
//
// loader ที่ใช้ node:fs / node:crypto อยู่ที่ raster-test-utils.ts (test-only)
//
// แตกต่างจาก AreaCase/LengthCase ที่เป็น exact-by-construction (ตัวเลขสะอาด):
//  ค่าเหล่านี้ต้อง **วัดจาก raster จริง** หลังจาก rasterize PDF → PNG
//  → ค่า px ทั้งหมดเป็น `null` ในตอนแรก จนกว่ามนุษย์จะเปิด raster แล้ววัด
//
// **ห้ามแต่ง px เอง** (กติกาในคำสั่ง stage-a) — ถ้ายังไม่ได้วัด → null
// ===========================================================================
import type { Pt } from '../../geometry';

/** ระยะที่ทราบจริงจากแบบ (calibrate หรือ verify) — px เป็น null จนกว่ามนุษย์จะวัดบน raster */
export type MeasuredSpan = {
  /** จุดต้นทางใน raster px (null = ยังไม่วัด) */
  aPx: Pt | null;
  /** จุดปลายทางใน raster px (null = ยังไม่วัด) */
  bPx: Pt | null;
  /** ระยะจริง (เมตร) ที่อ่านจาก drawing dim string */
  realM: number;
  /** คำอธิบายสำหรับ trace (เช่น "grid 1→6 แนวยาว") */
  note?: string;
};

/** Real-drawing fixture — ทุก px field เริ่มที่ null + ต้องเติมหลัง raster ครบ */
export type RasterMeasuredCase = {
  /** sheet id ที่แบบใช้เรียก (เช่น 'EE-02', 'SN-02') */
  sourceSheet: string;
  /** path ของ PNG (relative จาก raster/ subdir) */
  imageFile: string;
  /**
   * sha256 (lowercase hex) ของ PNG ที่ commit
   * null = ยังไม่มี PNG; เติมหลัง rasterize เสร็จ (ดู raster/README.md)
   */
  imageSha256: string | null;
  /** DPI ที่ใช้ render PDF → PNG (คงที่ตลอด project — เช่น 200) */
  renderDpi: number;

  /** Calibration span — แกนที่ใช้กำหนด upp (เช่น grid 1→6 = 26.00 m) */
  calib: MeasuredSpan;
  /** Verification span — แกนตั้งฉาก (เช่น grid A→C = 14.00 m) */
  verify: MeasuredSpan;

  /**
   * Grid-envelope polygon ใน raster px — 4 จุด grid intersection (เช่น 1A/6A/6C/1C)
   * **ไม่ใช่มุมผนัง** — เป็นกรอบ grid ที่ใช้ตรวจว่า scale + perpendicularity ถูกต้อง
   * null = ยังไม่ได้วัด
   */
  footprintPx: Pt[] | null;

  /** ค่า expected สำหรับ assertion (= calib.realM × verify.realM ของ grid envelope) */
  expectedAreaM2: number;
  /** tolerance สำหรับ |diff|/expected (≤ 0.01 = 1%) */
  tolerance: number;

  /** drawing reference เพิ่มเติม (เช่น dim strings, grid letters) */
  references?: string[];
};

/** helper: ทุก px field ครบ → พร้อมรัน assertion จริง (PURE — ไม่ต้องใช้ node) */
export function isPxReady(c: RasterMeasuredCase): boolean {
  return (
    c.calib.aPx !== null &&
    c.calib.bPx !== null &&
    c.verify.aPx !== null &&
    c.verify.bPx !== null &&
    c.footprintPx !== null &&
    c.footprintPx.length >= 3
  );
}
