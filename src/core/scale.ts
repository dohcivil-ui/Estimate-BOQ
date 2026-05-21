// src/core/scale.ts — PURE functions (spec §5.2). ห้าม import React/Konva
//
// ทุกค่าใน module นี้อยู่ใน "canonical page-px space" — page-pixel ของ raster
// ที่ render @ DrawingPage.renderScale ตอน import (frozen ตลอดอายุ project)
// unitPerPixel จึงเป็นเมตร / canonical-page-pixel (ไม่ใช่ PDF point หรือ screen px)
import type { LengthUnit, PagePoint } from '../types/coords';

export type { LengthUnit, PagePoint };

/** ระยะ pixel ระหว่าง 2 จุด (canonical page-coordinate) */
export function distancePx(a: PagePoint, b: PagePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** แปลงเป็นเมตร: m=×1, mm=÷1000 */
export function toMeters(value: number, unit: LengthUnit): number {
  return unit === 'mm' ? value / 1000 : value;
}

export interface ScaleProfile {
  pixelDistance: number;
  realDistance: number;
  unit: LengthUnit;
  /** เมตร / canonical page-pixel */
  unitPerPixel: number;
  /** canonical page-pixel / เมตร */
  pixelPerUnit: number;
}

/**
 * สร้าง scale จาก 2 จุด + ระยะจริง (spec §5.2)
 * unitPerPixel เป็น เมตร/พิกเซลเสมอ (แปลง mm → m ก่อนหาร)
 */
export function calibrateScale(
  p1: PagePoint,
  p2: PagePoint,
  realDistance: number,
  unit: LengthUnit,
): ScaleProfile {
  const pixelDistance = distancePx(p1, p2);
  const realMeters = toMeters(realDistance, unit);
  // กัน unitPerPixel/pixelPerUnit = Infinity/NaN ที่จะ poison BOQ ทุกบรรทัด
  // ใช้ !(x > 0) เพื่อจับ NaN, 0, ลบ พร้อมกัน
  if (!(pixelDistance > 0) || !(realMeters > 0)) {
    throw new Error('invalid scale: distance and real length must be > 0');
  }
  return {
    pixelDistance,
    realDistance,
    unit,
    unitPerPixel: realMeters / pixelDistance,
    pixelPerUnit: pixelDistance / realMeters,
  };
}
