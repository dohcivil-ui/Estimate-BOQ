// src/core/hittest.ts — PURE hit-test primitives (spec §10, §7.2)
// ห้าม import React/Konva — geometry ของ hit-test ทำใน "screen space" เพื่อให้
// hit radius คงที่ตอน zoom (กฎเหล็ก #2: เก็บ page-coord แต่ hit-test ใน screen-coord)
import type { Pt } from './geometry';

export type { Pt };

/**
 * ระยะที่สั้นที่สุดจากจุด p ถึง segment a→b (Euclidean)
 * ถ้าโปรเจกชันตกนอก segment จะ clamp ที่ปลายใกล้สุด (= clamped projection)
 * a==b (degenerate) → ระยะ p→a
 */
export function distancePointToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    // degenerate segment — ระยะถึงจุดเดียว
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Ray-casting point-in-polygon (open polygon — จุดสุดท้ายเชื่อมจุดแรกอัตโนมัติ)
 * จุดบนขอบมีพฤติกรรมไม่กำหนดแน่นอน (ขึ้นกับทิศ ray) — เป็นข้อจำกัดของ ray-casting มาตรฐาน
 * จุด < 3 → false (ไม่ใช่ polygon)
 */
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

/**
 * หา index ของ node ที่อยู่ใกล้จุด p ที่สุด **ภายใน** รัศมี radius (inclusive)
 * คืน -1 ถ้าไม่มี node ใดอยู่ในรัศมี
 */
export function nearestNodeIndex(p: Pt, pts: Pt[], radius: number): number {
  let best = -1;
  let bestDist = radius;
  for (let i = 0; i < pts.length; i++) {
    const n = pts[i]!;
    const d = Math.hypot(p.x - n.x, p.y - n.y);
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * หา index ของ segment (i = segment ระหว่าง pts[i] กับ pts[i+1]) ที่ใกล้จุด p ที่สุด
 * ภายใน tolerance — คืน -1 ถ้าไม่มี
 * closed=true → เพิ่ม segment สุดท้าย (pts[n-1] → pts[0]) ใช้กับ polygon
 */
export function nearestSegmentIndex(
  p: Pt,
  pts: Pt[],
  tolerance: number,
  closed = false,
): number {
  if (pts.length < 2) return -1;
  let best = -1;
  let bestDist = tolerance;
  const last = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const d = distancePointToSegment(p, a, b);
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}
