// src/core/geometry.ts — PURE functions (spec §5.3). ห้าม import React/Konva
//
// ทุกค่าใน module นี้อยู่ใน "canonical page-px space" — page-pixel ของ raster
// ที่ frozen ตอน import (เห็น docstring ของ DrawingPage) เพื่อให้ geometry ไม่ขยับ
// แม้จะ re-render bitmap คมขึ้นใน aftermath
export interface Pt {
  x: number;
  y: number;
}

/** ระยะ pixel ระหว่าง 2 จุด */
export function distancePx(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** ความยาวรวมแนวเส้น (px) — รองรับทั้ง line (2 จุด) และ polyline (n จุด) */
export function polylineLengthPx(pts: Pt[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += distancePx(pts[i - 1]!, pts[i]!);
  }
  return total;
}

/**
 * พื้นที่ polygon (px²) ด้วย Shoelace Formula — เป็นบวกเสมอ ไม่ขึ้นกับทิศ CW/CCW
 * polygon ปิดอัตโนมัติ (จุดสุดท้ายเชื่อมกลับจุดแรก) ตามมาตรฐาน shoelace
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
