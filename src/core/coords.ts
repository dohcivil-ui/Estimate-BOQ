// src/core/coords.ts — PURE coordinate transforms (spec §5). ห้าม import React/Konva
// page = พิกเซลต้นฉบับของหน้าแบบ (เก็บถาวร); screen = พิกัดบนจอ
export interface Pt { x: number; y: number; }
export interface ViewTransform {
  zoom: number; panX: number; panY: number;
  rotationDeg?: 0 | 90 | 180 | 270; // MVP รองรับ 0 ก่อน
}

/** page -> screen : screen = page*zoom + pan */
export function pageToScreen(_p: Pt, _t: ViewTransform): Pt {
  throw new Error('not implemented'); // TODO(cc): {x:p.x*zoom+panX, y:p.y*zoom+panY}
}

/** screen -> page : page = (screen - pan)/zoom */
export function screenToPage(_s: Pt, _t: ViewTransform): Pt {
  throw new Error('not implemented'); // TODO(cc): {x:(s.x-panX)/zoom, y:(s.y-panY)/zoom}
}
