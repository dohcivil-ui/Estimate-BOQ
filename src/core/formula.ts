// src/core/formula.ts — PURE: measurement → quantity (spec §5.3). ห้าม import React/Konva
// ทุก input pixel อยู่ใน canonical page-px space; unitPerPixel เป็นเมตร/canonical-page-pixel
import { polylineLengthPx, polygonAreaPx2, type Pt } from './geometry';

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
