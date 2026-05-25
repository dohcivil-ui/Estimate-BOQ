/**
 * Ortho lock — snap ทิศทางเป็น multiples ของ 45°
 * จาก "from" ไป "to" → return จุดใหม่ที่อยู่บนทิศที่ใกล้สุดของ 0/45/90/135/180/...°
 * ระยะคงเดิม
 */
import type { Pt } from './geometry';

const STEP = Math.PI / 4; // 45°

export function applyOrthoLock(from: Pt, to: Pt): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: to.x, y: to.y };
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / STEP) * STEP;
  return {
    x: from.x + Math.cos(snapped) * len,
    y: from.y + Math.sin(snapped) * len,
  };
}
