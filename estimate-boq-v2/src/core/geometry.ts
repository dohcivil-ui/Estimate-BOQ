/**
 * PURE geometry primitives — ทั้งหมดทำใน canonical page-px space
 * ห้าม import React/Konva/DOM (รับ data structures pure เท่านั้น)
 */
import type { Point2D } from '@/types/viewport';

export type Pt = Point2D;

/** ระยะ Euclidean ระหว่าง 2 จุด */
export function distancePx(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** ความยาว polyline (px) — รองรับ line (2 จุด) ถึง polyline (n จุด) */
export function polylineLengthPx(pts: Pt[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += distancePx(pts[i - 1]!, pts[i]!);
  }
  return total;
}

/**
 * พื้นที่ polygon (px²) ด้วย shoelace — เป็นบวกเสมอ ไม่ขึ้นทิศ CW/CCW
 * จุดสุดท้ายเชื่อมจุดแรกอัตโนมัติ (ไม่ต้องส่งจุดซ้ำ)
 * จุด < 3 → คืน 0
 */
export function polygonAreaPx2(pts: Pt[]): number {
  const n = pts.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** จุดที่อยู่ใกล้สุดบน segment a→b ของจุด p (clamped projection) */
export function projectPointOnSegment(
  p: Pt,
  a: Pt,
  b: Pt,
): { point: Pt; t: number; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) {
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    return { point: { x: a.x, y: a.y }, t: 0, distance: d };
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { point, t, distance: Math.hypot(p.x - point.x, p.y - point.y) };
}

/** จุดตัดของ 2 segment (ใน range [0,1] ของทั้งคู่) — null ถ้าไม่ตัดหรือขนาน */
export function segmentIntersection(
  p1: Pt,
  p2: Pt,
  p3: Pt,
  p4: Pt,
): Pt | null {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / denom;
  const u = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: p1.x + t * dx1, y: p1.y + t * dy1 };
}

/** Ray-casting point-in-polygon (จุดสุดท้ายเชื่อมจุดแรกอัตโนมัติ) */
export function pointInPolygon(p: Pt, pts: Pt[]): boolean {
  const n = pts.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = pts[i]!;
    const pj = pts[j]!;
    const intersects =
      pi.y > p.y !== pj.y > p.y &&
      p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** bounding box (page-px) ของ list จุด */
export function boundingBox(
  pts: Pt[],
): { x: number; y: number; w: number; h: number } | null {
  if (pts.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
