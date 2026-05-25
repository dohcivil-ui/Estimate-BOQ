/**
 * PURE: measurement → quantity (สูตรเดียวกับ Track A spec §5.3)
 * ห้าม import React/Konva
 */
import {
  polylineLengthPx,
  polygonAreaPx2,
  type Pt,
} from './geometry';

/** ความยาวจริง (ม.) = pixelLength × unitPerPixel — รองรับทั้ง line (2 จุด) และ polyline (n จุด) */
export function lineQuantity(pts: Pt[], unitPerPixel: number): number {
  return polylineLengthPx(pts) * unitPerPixel;
}

/** พื้นที่จริง (ม²) = polygonAreaPx2 × unitPerPixel² (ยกกำลังสอง!) */
export function polygonQuantity(pts: Pt[], unitPerPixel: number): number {
  return polygonAreaPx2(pts) * unitPerPixel * unitPerPixel;
}

/** จำนวนนับ */
export function countQuantity(markerCount: number): number {
  return markerCount;
}

/** เส้นรอบรูป (perimeter) ของ polygon (ม.) — รวม segment ปิด */
export function polygonPerimeter(pts: Pt[], unitPerPixel: number): number {
  if (pts.length < 3) return 0;
  let total = polylineLengthPx(pts);
  const a = pts[pts.length - 1]!;
  const b = pts[0]!;
  total += Math.hypot(a.x - b.x, a.y - b.y);
  return total * unitPerPixel;
}
