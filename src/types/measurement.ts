// src/types/measurement.ts — Measurement data model (spec §8)
import type { PagePoint } from './coords';

export type MeasurementType =
  | 'scale_reference'
  | 'line'
  | 'polyline'
  | 'polygon_area'
  | 'rectangle_area'
  | 'lasso_area'
  | 'count_marker'
  | 'region_selection';

export type MeasurementStatus =
  | 'draft'
  | 'confirmed'
  | 'linked_to_boq'
  | 'ai_suggested'
  | 'locked'
  | 'archived';

export type MeasurementUnit = 'm' | 'm2' | 'm3' | 'ea' | 'set';

export type MeasurementGeometry =
  | { kind: 'point'; point: PagePoint }
  | { kind: 'line'; points: [PagePoint, PagePoint] }
  | { kind: 'polyline'; points: PagePoint[] }
  | { kind: 'polygon'; points: PagePoint[] }
  | { kind: 'rectangle'; x: number; y: number; width: number; height: number }
  | { kind: 'lasso'; points: PagePoint[] };

// Forward declaration; full BOQ link shape lives in spec §11 (Phase 4)
export type MeasurementBOQLink = {
  id: string;
  measurementId: string;
  boqItemId: string;
  formulaId: string;
  factor: number;
  wasteFactor?: number;
  quantityContribution: number;
  note?: string;
};

export type Measurement = {
  id: string;
  projectId: string;
  drawingPageId: string;
  type: MeasurementType;
  geometry: MeasurementGeometry;
  label?: string;
  categoryId?: string;
  quantity: number;
  unit: MeasurementUnit;
  scaleId: string;
  status: MeasurementStatus;
  boqLinks: MeasurementBOQLink[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
};
