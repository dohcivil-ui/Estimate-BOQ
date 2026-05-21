// src/core/geometry.ts — PURE functions (spec §5.3). page coordinate ทั้งหมด
export interface Pt { x: number; y: number; }

export function distancePx(_a: Pt, _b: Pt): number {
  throw new Error('not implemented'); // TODO(cc): hypot
}

/** ความยาวรวมแนวเส้น (px) */
export function polylineLengthPx(_pts: Pt[]): number {
  throw new Error('not implemented'); // TODO(cc): ผลรวม distance ทีละ segment
}

/** พื้นที่ polygon (px²) ด้วย shoelace — เป็นบวกเสมอ ไม่ขึ้นกับทิศ CW/CCW */
export function polygonAreaPx2(_pts: Pt[]): number {
  throw new Error('not implemented'); // TODO(cc): |Σ(xi*yj - xj*yi)|/2
}
