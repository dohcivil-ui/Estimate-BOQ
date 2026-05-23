// src/schema/v1/guards.ts — runtime invariants for schema v1
//
// PURE (no React/Konva). Fail-loud: ถ้าผิด invariant → throw พร้อม context.
// ห้าม silent fix หรือ auto-correct — ผู้เรียก/ผู้ใช้ต้องรับมือเอง (Golden Rule §3).
//
// SCOPE: assertion เท่านั้น. ห้ามเพิ่ม IO/storage/IndexedDB ที่นี่.

import type { Sheet, Calibration, Measurement, Line } from './types';

/**
 * raster fingerprint ที่ caller (IO boundary) คำนวณแล้วส่งเข้ามาเทียบ:
 *   - widthPx/heightPx จาก raster ที่ decode จริง
 *   - sha256 = sha256 hex (lowercase) ของ raster bytes
 * guard เพียงเทียบ — ไม่ hash เอง → ยังคง pure
 */
export type SheetRaster = {
  widthPx: number;
  heightPx: number;
  sha256: string;
};

/**
 * Sheet load: raster ที่โหลดต้องมีทั้งขนาด **และ** sha256 ตรงกับ Sheet ที่บันทึกไว้
 * (canonical px แช่แข็ง — geometry ที่เก็บอ้าง px + bytes ของ raster ตัวนี้ ห้ามขยับ)
 *
 * mismatch ใดๆ → throw พร้อมระบุว่าฟิลด์ไหนไม่ตรง (กัน raster swap ขนาดเหมือนกัน
 * แต่ bytes ต่าง = ปิดช่อง 🔴-1)
 */
export function assertSheetMatchesRaster(sheet: Sheet, raster: SheetRaster): void {
  const mismatches: string[] = [];
  if (sheet.widthPx !== raster.widthPx || sheet.heightPx !== raster.heightPx) {
    mismatches.push(
      `dimensions (sheet=${sheet.widthPx}×${sheet.heightPx}, ` +
        `raster=${raster.widthPx}×${raster.heightPx})`,
    );
  }
  if (sheet.sha256 !== raster.sha256) {
    // ตัดแสดง 8 hex แรกพอ — log ไม่ต้องเปื้อน hash เต็ม
    mismatches.push(
      `sha256 (sheet=${sheet.sha256.slice(0, 8)}…, raster=${raster.sha256.slice(0, 8)}…)`,
    );
  }
  if (mismatches.length > 0) {
    throw new Error(
      `Sheet ${sheet.id} load: raster mismatch — ${mismatches.join('; ')} — ` +
        `canonical px is frozen; re-import the page instead of swapping raster.`,
    );
  }
}

/**
 * Measurement integrity:
 *   1. measurement.sheetId ต้องชี้ Sheet ที่มีจริง
 *   2. measurement.calibrationId ต้องชี้ Calibration ที่มีจริง
 *   3. lookup(calibrationId).sheetId === measurement.sheetId
 *      (upp ข้ามแผ่นไม่ได้ — แต่ละ sheet มี canonical px ของตัวเอง)
 */
export function assertMeasurementIntegrity(
  measurement: Measurement,
  sheetById: ReadonlyMap<string, Sheet>,
  calibrationById: ReadonlyMap<string, Calibration>,
): void {
  if (!sheetById.has(measurement.sheetId)) {
    throw new Error(
      `Measurement ${measurement.id}: sheetId ${measurement.sheetId} not found`,
    );
  }
  const calib = calibrationById.get(measurement.calibrationId);
  if (!calib) {
    throw new Error(
      `Measurement ${measurement.id}: calibrationId ${measurement.calibrationId} not found`,
    );
  }
  if (calib.sheetId !== measurement.sheetId) {
    throw new Error(
      `Measurement ${measurement.id}: calibration ${calib.id} belongs to sheet ` +
        `${calib.sheetId} but measurement is on sheet ${measurement.sheetId} — ` +
        `upp cannot cross sheets`,
    );
  }
}

/**
 * Line invariant: origin==='manual' ⇒ excludedFromGate===true
 * (manual lines ผู้ใช้กรอกเอง ห้ามนับใน gate — กันสร้างยอดลม)
 */
export function assertLineInvariant(line: Line): void {
  if (line.origin === 'manual' && !line.excludedFromGate) {
    throw new Error(
      `Line ${line.id}: origin='manual' must have excludedFromGate=true ` +
        `(manual lines never count toward the gate)`,
    );
  }
}

/**
 * isCalibrationVerified — true ถ้า calibration ผ่าน verifyScale มาแล้ว
 *   (anisotropy ถูก set เป็นตัวเลข, รวมถึง 0 = isotropic perfect)
 *   false = ยังเป็น null (สร้างใหม่ ยังไม่ verify)
 *
 * PURE: อ่านฟิลด์เดียว, ไม่มี side effect.
 *
 * TODO(gate-layer): ในรอบนี้ assertMeasurementIntegrity **ไม่ throw** เมื่อ
 *   measurement ใช้ calibration ที่ unverified — เป็น **warning** ของ
 *   gate layer ภายหลัง (data-safety v2+ จะเพิ่ม collectGateWarnings ที่อ่าน
 *   isCalibrationVerified แล้วรายงาน). อย่าเลื่อนมาเป็น throw ที่ schema layer
 *   เพราะจะ block flow ของผู้ใช้ขณะกำลัง calibrate.
 */
export function isCalibrationVerified(calib: Calibration): boolean {
  return calib.anisotropy !== null;
}
