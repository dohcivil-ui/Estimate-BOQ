/**
 * PURE coordinate transforms (port จาก Track A `src/core/coords.ts`)
 * ห้าม import React/Konva — ใช้สำหรับการแปลงพิกัดทุกที่ในแอป
 *
 * page = พิกัดในหน้าแบบ (canonical, frozen @ import)
 * screen = พิกัดบน Konva Stage / DOM
 *
 * ความสัมพันธ์: screen = page * zoom + pan
 */
import type { Point2D, ViewTransform } from '@/types/viewport';

export function pageToScreen(p: Point2D, t: ViewTransform): Point2D {
  return { x: p.x * t.zoom + t.panX, y: p.y * t.zoom + t.panY };
}

export function screenToPage(s: Point2D, t: ViewTransform): Point2D {
  return { x: (s.x - t.panX) / t.zoom, y: (s.y - t.panY) / t.zoom };
}

/** ตรวจว่า round-trip ไม่เพี้ยน (สำหรับ test ในอนาคต) */
export function roundTripError(p: Point2D, t: ViewTransform): number {
  const s = pageToScreen(p, t);
  const back = screenToPage(s, t);
  return Math.hypot(back.x - p.x, back.y - p.y);
}
