// src/core/formula.ts — PURE: measurement → quantity (spec §5.3). ห้าม import React/Konva
// ทุก input pixel อยู่ใน canonical page-px space; unitPerPixel เป็นเมตร/canonical-page-pixel
import { polylineLengthPx, polygonAreaPx2, type Pt } from './geometry';

export type { Pt };

/** ความยาวจริง (เมตร) = pixelLength × unitPerPixel — รองรับ line (2 จุด) และ polyline (n จุด) */
export function lineQuantity(pts: Pt[], unitPerPixel: number): number {
  return polylineLengthPx(pts) * unitPerPixel;
}

/** พื้นที่จริง (ม²) = polygonAreaPx2 × unitPerPixel² (ยกกำลังสอง!) */
export function polygonQuantity(pts: Pt[], unitPerPixel: number): number {
  return polygonAreaPx2(pts) * unitPerPixel * unitPerPixel;
}

/** พื้นที่สี่เหลี่ยม (ม²) จาก width/height pixel */
export function rectQuantity(widthPx: number, heightPx: number, unitPerPixel: number): number {
  return widthPx * heightPx * unitPerPixel * unitPerPixel;
}

/** จำนวนนับ */
export function countQuantity(markerCount: number): number {
  return markerCount;
}

// =============================================================================
// Validation-grade additions (Phase v-validate)
// — ผ่าน formula.ts ที่เดียว, ห้ามทำ inline ในคอมโพเนนต์ (Golden Rule #3)
// =============================================================================

/** Opening (ช่องที่หักออกจากพื้นที่รวม) — polygon ใน page-px */
export type Opening = {
  /** polygon vertices (canonical page-px) */
  points: Pt[];
};

/**
 * netArea — พื้นที่สุทธิ = shoelace(gross) × upp² − Σ openings ที่ area ≥ thresholdM2
 *
 * thresholdM2 (default 0.5 m²) คือ "เกณฑ์ขั้นต่ำ" สำหรับช่องที่นับหัก
 *  เช่น รูเล็ก/รอยตำหนิ < 0.5 m² ถูกข้าม
 *  หน้าต่าง/ประตู ≥ 0.5 m² ถูกหัก
 *
 * ทุก area คำนวณผ่าน polygonQuantity() (shoelace × upp²) → ค่ายกกำลังสอง upp อยู่ที่ formula.ts ที่เดียว
 */
export function netArea(
  grossPolygon: Pt[],
  openings: Opening[],
  unitPerPixel: number,
  thresholdM2 = 0.5,
): number {
  const gross = polygonQuantity(grossPolygon, unitPerPixel);
  let deduct = 0;
  for (const o of openings) {
    const a = polygonQuantity(o.points, unitPerPixel);
    if (a >= thresholdM2) deduct += a;
  }
  return gross - deduct;
}

/**
 * lengthPolyline — Σ segment euclidean × upp; closed=true เพิ่ม segment ปิด (last→first)
 *
 * แตกต่างจาก lineQuantity ที่เป็น open chain เท่านั้น —
 * fn นี้ใช้ได้กับ perimeter ของ polygon (closed=true) ผ่าน formula.ts ที่เดียว
 * จุด < 2 → คืน 0 (degenerate)
 */
export function lengthPolyline(
  points: Pt[],
  unitPerPixel: number,
  closed = false,
): number {
  if (points.length < 2) return 0;
  let totalPx = polylineLengthPx(points);
  if (closed && points.length >= 3) {
    const a = points[points.length - 1]!;
    const b = points[0]!;
    totalPx += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return totalPx * unitPerPixel;
}

/** ตัวอย่าง scale sample (จุด 2 จุดที่ทราบระยะจริง) — ใช้กับ verifyScale */
export type ScaleSample = {
  realDistance: number;
  pixelDistance: number;
};

/**
 * verifyScale — ตรวจ isotropy ระหว่างแกน calib กับแกน verify
 *
 *   anisotropy = |calibUpp / verifyUpp − 1|
 *   (calibUpp = calib.realDistance / calib.pixelDistance; verifyUpp ในทำนองเดียวกัน)
 *
 *  > 0.01 (1%) → **throw** (fail loud)
 *  ห้าม auto-correct เด็ดขาด — ถ้า drawing ไม่ uniform แปลว่า scale ผิด ผู้ใช้ต้องแก้เอง
 *
 *  ใช้หลัง user calibrate แกนหนึ่ง (เช่น x = 26m) แล้ว verify แกนอีกแกน (เช่น y = 14m)
 *  ถ้า anisotropy เกิน threshold = แบบไม่ to-scale (หรือ user กรอกผิด) → measurement ทั้งหน้าใช้ไม่ได้
 */
export function verifyScale(
  calib: ScaleSample,
  verify: ScaleSample,
): { anisotropy: number } {
  // input guard — ใช้ !(x > 0) จับ NaN/0/ลบ พร้อมกัน (เหมือน calibrateScale)
  if (
    !(calib.pixelDistance > 0) ||
    !(verify.pixelDistance > 0) ||
    !(calib.realDistance > 0) ||
    !(verify.realDistance > 0)
  ) {
    throw new Error('verifyScale: realDistance and pixelDistance must be > 0');
  }
  const calibUpp = calib.realDistance / calib.pixelDistance;
  const verifyUpp = verify.realDistance / verify.pixelDistance;
  const anisotropy = Math.abs(calibUpp / verifyUpp - 1);
  if (anisotropy > 0.01) {
    throw new Error(
      `verifyScale: anisotropy ${(anisotropy * 100).toFixed(2)}% > 1% threshold — ` +
        `drawing is not isotropic (calib upp=${calibUpp.toExponential(4)}, ` +
        `verify upp=${verifyUpp.toExponential(4)}). ` +
        `Re-calibrate or pick different reference distances; do NOT auto-correct.`,
    );
  }
  return { anisotropy };
}
