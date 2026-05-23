// src/schema/v1/types.ts — data-safety v1 SCHEMA (persistence shape)
//
// SCOPE (v1): pure types + envelope. NO storage/IO/import — invariants live in
// ./guards.ts. Storage/IndexedDB/autosave/import = ด่านถัดไป, ห้ามทำที่นี่.
//
// These types are intentionally separate from src/types/{measurement,boq,
// drawing}.ts (in-memory app state). The storage layer (next phase) will
// translate between in-memory state and this persisted contract.
//
// Reuses Pt from core/geometry and Opening from core/formula (type-only import;
// formula.ts is not modified per current scope).

import type { Pt } from '../../core/geometry';
import type { Opening } from '../../core/formula';

/** Bump เมื่อ shape เปลี่ยน (ห้ามแก้แบบเงียบ — storage layer ใช้ค่านี้ตัดสินใจ migrate) */
export const SCHEMA_VERSION = 1 as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

/** ISO-8601 timestamp string */
export type Timestamp = string;

// =============================================================================
// Sheet — page raster ที่ frozen ตอน import
//   widthPx/heightPx = canonical page-pixel space ของ raster ที่ render @ renderScale
//   geometry ทุกชิ้นในระบบเก็บพิกัดใน space นี้ → ห้ามเปลี่ยนตลอดอายุ project
//   (บังคับผ่าน assertSheetMatchesRaster ตอนโหลด)
// =============================================================================
export type Sheet = {
  id: string;
  projectId: string;
  sourceFileId: string;
  pageIndex: number;
  /** scale ที่ใช้ render bitmap ครั้งแรก (จาก pdfjs viewport) */
  renderScale: number;
  /** canonical page-pixel width — frozen */
  widthPx: number;
  /** canonical page-pixel height — frozen */
  heightPx: number;
  dpi: number;
  /** sha256 hex ของ raster bytes — กัน raster swap ที่ขนาดเหมือนกัน */
  sha256: string;
};

// =============================================================================
// Calibration — scale 1 ครั้งของ sheet 1 แผ่น
//   upp = meters / canonical-page-pixel (ตรงกับ ScaleProfile.unitPerPixel)
// =============================================================================
export type Calibration = {
  id: string;
  sheetId: string;
  // TODO(schema-v2): regionId ชี้ entity ใด — Region type ยังไม่ได้นิยามใน codebase.
  //   เก็บเป็น optional string ไปก่อน; per-region calibration จะ narrow type
  //   เมื่อ Region ถูกระบุครบ. อย่าตั้งสมมติฐานเรื่องรูปแบบของ id ในรอบนี้.
  regionId?: string;
  /** meters / canonical page-pixel */
  upp: number;
  sourceDim: {
    label: string;
    realM: number;
  };
  /** |calibUpp / verifyUpp − 1| จาก verifyScale; 0 = ยังไม่ verify */
  anisotropy: number;
  ts: Timestamp;
};

// =============================================================================
// Measurement — รายการวัด; pointsPx อยู่ใน canonical page-px ของ sheetId ที่อ้างถึง
// =============================================================================
export type MeasurementKind = 'area' | 'length' | 'count';

export type Measurement = {
  id: string;
  sheetId: string;
  calibrationId: string;
  kind: MeasurementKind;
  /** canonical page-px (count: หนึ่งจุดต่อ marker; length/area: ตามลำดับ vertex) */
  pointsPx: Pt[];
  /** openings ที่หักจาก area (ใช้กับ kind='area' เท่านั้น) */
  deductsOpenings?: Opening[];
  /** threshold m² สำหรับ openings; undefined = ใช้ default ของ formula.netArea */
  thresholdM2?: number;
};

// =============================================================================
// Override — บันทึก override ฟิลด์ใดก็ตามบน entity ใด
// =============================================================================
// TODO(schema-v2): ยังไม่ระบุ namespace ของ targetId (Sheet|Calibration|
//   Measurement|Line|BOQ?), ไม่ระบุ enum ของ field หรือ source ('user'|'ai'|
//   'rule'?). เก็บ wide (string + unknown) ในรอบนี้ — narrow เมื่อ usecase ชัด.
//   อย่าแต่งค่า/ใส่ enum ไปก่อน เพราะจะล็อก migration ภายหลัง.
export type Override = {
  /** id ของ entity ที่ถูก override (namespace ยังไม่บังคับใน v1) */
  targetId: string;
  /** ชื่อฟิลด์ที่ override (key ของ entity, ยังไม่ narrow) */
  field: string;
  /** ค่าใหม่ — unknown ใน v1 */
  value: unknown;
  /** ที่มาของ override (ยังไม่ enum ใน v1) */
  source: string;
  author: string;
  ts: Timestamp;
  /** override นี้ทำให้ entity ไม่เป็นไปตามมาตรฐาน — gate ต้องเห็น */
  isNonStandard: boolean;
};

// =============================================================================
// Line — รายการ BOQ line entry (1 entity, ไม่ใช่เรขาคณิต)
//   derived = สร้างจาก measurement, ผ่าน gate ปกติ
//   manual  = ผู้ใช้กรอกเอง, ห้ามนับใน gate (บังคับด้วย assertLineInvariant)
//
// NOTE: qty/amount ห้ามเก็บในนี้ — derived ผ่าน formula.ts ทุกครั้ง (Golden Rule #4)
// =============================================================================
export type Line = {
  id: string;
  origin: 'derived' | 'manual';
  excludedFromGate: boolean;
  note?: string;
};

// =============================================================================
// Envelope — bundle ที่ persist ครั้งเดียวต่อ project
//   ทุก persisted blob ห่อด้วย Envelope (มี projectId + schemaVersion เสมอ)
//   BOQ qty/amount ห้ามเก็บใน envelope — derive ผ่าน formula.ts (no duplicate state)
// =============================================================================
export type Envelope = {
  projectId: string;
  schemaVersion: SchemaVersion;
  sheets: Sheet[];
  calibrations: Calibration[];
  measurements: Measurement[];
  overrides: Override[];
  lines: Line[];
};
