/**
 * PURE scale calibration — ห้าม import React/Konva
 * ทุกพิกัดอยู่ใน canonical page-px space
 *
 * unitPerPixel = เมตร / canonical-page-pixel
 */
import { distancePx, type Pt } from './geometry';

export type LengthUnit = 'm' | 'mm' | 'cm';

export interface ScaleProfile {
  pixelDistance: number;
  realDistance: number;
  unit: LengthUnit;
  /** เมตร / canonical page-pixel */
  unitPerPixel: number;
  /** canonical page-pixel / เมตร */
  pixelPerUnit: number;
  createdAt: string;
}

/** แปลงเป็นเมตร: m=×1, cm=÷100, mm=÷1000 */
export function toMeters(value: number, unit: LengthUnit): number {
  if (unit === 'mm') return value / 1000;
  if (unit === 'cm') return value / 100;
  return value;
}

/**
 * สร้าง scale จาก 2 จุด + ระยะจริง
 * - กัน NaN/Infinity ด้วย `!(x > 0)` (จับ 0/ลบ/NaN พร้อมกัน)
 * - throw ถ้า input ไม่ถูกต้อง — caller ต้อง catch แล้วแสดง error ให้ user
 */
export function calibrateScale(
  p1: Pt,
  p2: Pt,
  realDistance: number,
  unit: LengthUnit,
): ScaleProfile {
  const pixelDistance = distancePx(p1, p2);
  const realMeters = toMeters(realDistance, unit);
  if (!(pixelDistance > 0) || !(realMeters > 0)) {
    throw new Error('ตั้งสเกลไม่สำเร็จ: ระยะ pixel และระยะจริงต้องมากกว่า 0');
  }
  return {
    pixelDistance,
    realDistance,
    unit,
    unitPerPixel: realMeters / pixelDistance,
    pixelPerUnit: pixelDistance / realMeters,
    createdAt: new Date().toISOString(),
  };
}

/** แปลง pixel distance → meters ผ่าน scale profile */
export function pxToMeters(px: number, profile: ScaleProfile): number {
  return px * profile.unitPerPixel;
}

/** format ระยะเป็นข้อความไทย (เช่น "12.34 ม.") */
export function formatLength(meters: number, fraction = 2): string {
  if (!isFinite(meters)) return '—';
  return `${meters.toFixed(fraction)} ม.`;
}

/** format พื้นที่เป็นข้อความไทย (เช่น "123.45 ตร.ม.") */
export function formatArea(m2: number, fraction = 2): string {
  if (!isFinite(m2)) return '—';
  return `${m2.toFixed(fraction)} ตร.ม.`;
}
