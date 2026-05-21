// src/core/coords.ts — PURE coordinate transforms (spec §5). ห้าม import React/Konva
// page = พิกเซลต้นฉบับของหน้าแบบ (เก็บถาวร); screen = พิกัดบนจอ
export interface Pt {
  x: number;
  y: number;
}
export interface ViewTransform {
  zoom: number;
  panX: number;
  panY: number;
  rotationDeg?: 0 | 90 | 180 | 270; // MVP รองรับ 0 ก่อน
}

/** page -> screen : screen = page*zoom + pan */
export function pageToScreen(p: Pt, t: ViewTransform): Pt {
  return { x: p.x * t.zoom + t.panX, y: p.y * t.zoom + t.panY };
}

/** screen -> page : page = (screen - pan)/zoom */
export function screenToPage(s: Pt, t: ViewTransform): Pt {
  return { x: (s.x - t.panX) / t.zoom, y: (s.y - t.panY) / t.zoom };
}
