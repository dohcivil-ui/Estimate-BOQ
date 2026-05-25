/**
 * PURE hit-test — ทำใน "screen space" เพื่อให้ hit radius คงที่ตอน zoom
 * (Golden Rule: เก็บ page-coord แต่ hit-test ใน screen-coord)
 */
import { projectPointOnSegment, type Pt } from './geometry';

/** distance จากจุด p ถึง segment a→b (clamped projection) */
export function distancePointToSegment(p: Pt, a: Pt, b: Pt): number {
  return projectPointOnSegment(p, a, b).distance;
}

/** node ที่ใกล้สุด **ภายใน** รัศมี (inclusive) — คืน -1 ถ้าไม่มี */
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

/** segment ที่ใกล้สุดในรัศมี — closed=true เพิ่ม segment สุดท้าย→แรก (สำหรับ polygon) */
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
