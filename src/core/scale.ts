// src/core/scale.ts — PURE functions (spec §5.2). ห้าม import React/Konva
export type LengthUnit = 'm' | 'mm';
export interface PagePoint { x: number; y: number; }

/** ระยะ pixel ระหว่าง 2 จุด (page coordinate) */
export function distancePx(_a: PagePoint, _b: PagePoint): number {
  throw new Error('not implemented'); // TODO(cc): hypot(dx,dy)
}

/** แปลงเป็นเมตร: m=×1, mm=÷1000 */
export function toMeters(_value: number, _unit: LengthUnit): number {
  throw new Error('not implemented'); // TODO(cc)
}

export interface ScaleProfile {
  pixelDistance: number; realDistance: number; unit: LengthUnit;
  unitPerPixel: number;  // เมตร/พิกเซล
  pixelPerUnit: number;  // พิกเซล/เมตร
}

/** สร้าง scale จาก 2 จุด + ระยะจริง (spec §5.2). unitPerPixel เป็น เมตร/พิกเซลเสมอ */
export function calibrateScale(
  _p1: PagePoint, _p2: PagePoint, _realDistance: number, _unit: LengthUnit,
): ScaleProfile {
  throw new Error('not implemented'); // TODO(cc): realMeters/pixelDist และส่วนกลับ
}
