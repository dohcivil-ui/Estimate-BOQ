/**
 * Measurement model — ทุก geometry เก็บเป็น "canonical page-px"
 * (frozen ตั้งแต่ import drawing — ห้ามขยับเมื่อ re-render bitmap)
 *
 * status:
 *   - 'draft'    = กำลังวาด ยังไม่ commit
 *   - 'confirmed' = กดจบแล้ว
 */
import type { Point2D } from './viewport';

export type MeasurementType = 'length' | 'area' | 'count' | 'scale';
export type MeasurementStatus = 'draft' | 'confirmed';

export interface BaseMeasurement {
  id: string;
  pageId: string;
  type: MeasurementType;
  status: MeasurementStatus;
  layer: string;
  /** ชื่อที่ผู้ใช้ตั้ง (เช่น "ผนังด้านเหนือ") — optional */
  name?: string;
  /** label อัตโนมัติ เช่น "12.34 ม." */
  label: string;
  /** จุด (canonical page-px) */
  points: Point2D[];
  createdAt: string;
  updatedAt: string;
}

export interface LengthMeasurement extends BaseMeasurement {
  type: 'length';
  /** ความยาวจริง (ม.) — คำนวณจาก formula.lineQuantity */
  lengthM: number;
}

export interface AreaMeasurement extends BaseMeasurement {
  type: 'area';
  areaM2: number;
  perimeterM: number;
}

export interface CountMeasurement extends BaseMeasurement {
  type: 'count';
  /** = points.length */
  count: number;
}

export interface ScaleMeasurement extends BaseMeasurement {
  type: 'scale';
  /** ระยะจริงที่ผู้ใช้กรอก */
  realDistance: number;
  unit: 'm' | 'mm' | 'cm';
}

export type Measurement =
  | LengthMeasurement
  | AreaMeasurement
  | CountMeasurement
  | ScaleMeasurement;
