// src/core/formula.ts — PURE: measurement → quantity (spec §5.3). ห้าม import React/Konva
import { polylineLengthPx, polygonAreaPx2, type Pt } from './geometry';

/** ความยาวจริง (เมตร) = pixelLength × unitPerPixel */
export function lineQuantity(_pts: Pt[], _unitPerPixel: number): number {
  throw new Error('not implemented'); // TODO(cc): polylineLengthPx × unitPerPixel
}

/** พื้นที่จริง (ม²) = polygonAreaPx2 × unitPerPixel² (ยกกำลังสอง!) */
export function polygonQuantity(_pts: Pt[], _unitPerPixel: number): number {
  throw new Error('not implemented'); // TODO(cc): polygonAreaPx2 × unitPerPixel**2
}

/** พื้นที่สี่เหลี่ยม (ม²) จาก width/height pixel */
export function rectQuantity(_widthPx: number, _heightPx: number, _unitPerPixel: number): number {
  throw new Error('not implemented'); // TODO(cc): w*h*unitPerPixel**2
}

/** จำนวนนับ */
export function countQuantity(_markerCount: number): number {
  throw new Error('not implemented'); // TODO(cc): markerCount
}
