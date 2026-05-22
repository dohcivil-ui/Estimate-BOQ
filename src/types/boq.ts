// src/types/boq.ts — BOQ data model (spec §11)

export type WorkCategory = 'structure' | 'architecture' | 'mep' | 'other';
export type BOQUnit = 'm' | 'm2' | 'm3' | 'ea' | 'set';
export type BOQSource = 'manual' | 'measurement' | 'ai_suggested';

/**
 * MeasurementBOQLink (spec §11):
 *  - factor + wasteFactor + measurement.quantity → quantityContribution (DERIVED)
 *  - quantityContribution **ห้ามเก็บใน state** — คำนวณ on-the-fly ผ่าน computeContribution()
 */
export type MeasurementBOQLink = {
  id: string;
  measurementId: string;
  boqItemId: string;
  /** formula identifier (เช่น 'line_length', 'polygon_area', 'count'); MVP เก็บไว้เพื่อ trace */
  formulaId: string;
  /** multiplier ที่นำมาคูณ measurement.quantity (เช่น wallHeight, thickness) */
  factor: number;
  /** เผื่อ waste (เช่น 0.05 = +5%) */
  wasteFactor?: number;
  /** quantityContribution = measurement.quantity × factor × (1 + wasteFactor) — derived */
  quantityContribution: number;
  note?: string;
};

/**
 * BOQItem (spec §11):
 *  - `quantity` และ `amount` เป็น **DERIVED** จาก links + unitPrice (ห้ามเก็บใน state อิสระ)
 *  - ใช้ computeBOQView() คำนวณค่าใหม่จาก store ทุกครั้ง
 *  - `source='measurement'` ต้องมี links ไม่ว่าง (Golden Rule #4 traceability)
 */
export type BOQItem = {
  id: string;
  projectId: string;
  code: string;
  description: string;
  workCategory: WorkCategory;
  unit: BOQUnit;
  /** DERIVED — Σ link.quantityContribution */
  quantity: number;
  unitPrice?: number;
  /** DERIVED — quantity × unitPrice (undefined ถ้าไม่มี unitPrice) */
  amount?: number;
  source: BOQSource;
  links: MeasurementBOQLink[];
};
