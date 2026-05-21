// src/types/coords.ts — Coordinate system types (spec §5.1)
// แยก coordinate 4 ชุดให้ชัด — กฎเหล็ก: เก็บ geometry เป็น PagePoint, hit-test ใน ScreenPoint

export type ScreenPoint = { clientX: number; clientY: number };

export type PagePoint = { x: number; y: number };

export type LengthUnit = 'm' | 'mm';

export type RealPoint = { x: number; y: number; unit: LengthUnit };

export type ViewTransform = {
  zoom: number;
  panX: number;
  panY: number;
  rotationDeg: 0 | 90 | 180 | 270;
};
