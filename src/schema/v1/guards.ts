// src/schema/v1/guards.ts — runtime invariants for schema v1
//
// PURE (no React/Konva). Fail-loud: ถ้าผิด invariant → throw พร้อม context.
// ห้าม silent fix หรือ auto-correct — ผู้เรียก/ผู้ใช้ต้องรับมือเอง (Golden Rule §3).
//
// SCOPE: assertion เท่านั้น. ห้ามเพิ่ม IO/storage/IndexedDB ที่นี่.

import type { Sheet, Calibration, Measurement, Line } from './types';

export type SheetRaster = { widthPx: number; heightPx: number };

/**
 * Sheet load: raster ที่โหลดต้องมีขนาดตรงกับ Sheet ที่บันทึกไว้
 * (canonical px แช่แข็ง — geometry ที่เก็บอ้าง px ของ raster ตัวนี้ ห้ามขยับ)
 */
export function assertSheetMatchesRaster(sheet: Sheet, raster: SheetRaster): void {
  if (sheet.widthPx !== raster.widthPx || sheet.heightPx !== raster.heightPx) {
    throw new Error(
      `Sheet ${sheet.id} load: raster size mismatch ` +
        `(sheet=${sheet.widthPx}x${sheet.heightPx}, ` +
        `raster=${raster.widthPx}x${raster.heightPx}) — ` +
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
