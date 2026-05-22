// src/types/ai.ts — AI hook data model (spec §12.2, §12.3) — shape ตรงตามสเปกเป๊ะ
// ห้ามเพิ่ม field ที่ไม่อยู่ในสเปก, ห้ามตัด field ที่อยู่ในสเปก
import type { Measurement, MeasurementGeometry } from './measurement';
import type { BOQItem } from './boq';
import type { LengthUnit } from './coords';

/** AI mode (spec §12.2) */
export type AIMode =
  | 'boq_review'
  | 'suggest_items'
  | 'explain_quantity'
  | 'region_analyze';

/** Selected region (สำหรับ region_analyze / suggest_items) — optional */
export type AISelectedRegion = {
  geometry: MeasurementGeometry;
  cropImageUrl?: string;
  cropImageBase64?: string;
};

/** AIReviewRequest — payload ที่ส่งไป AI API Engine (spec §12.2) */
export type AIReviewRequest = {
  requestId: string;
  project: {
    id: string;
    name: string;
    buildingType?: string;
  };
  drawingContext: {
    drawingPageId: string;
    pageNumber: number;
    scale: {
      unit: LengthUnit;
      unitPerPixel: number;
    };
    selectedRegion?: AISelectedRegion;
  };
  measurements: Measurement[];
  boqItems: BOQItem[];
  userQuestion?: string;
  mode: AIMode;
};

/** AISuggestion type tag (spec §12.3) */
export type AISuggestionType =
  | 'missing_boq_item'
  | 'quantity_anomaly'
  | 'duplicate_item'
  | 'category_suggestion'
  | 'formula_suggestion'
  | 'explanation';

export type AISeverity = 'info' | 'warning' | 'critical';

/** AISuggestion — schema ตอบกลับ (spec §12.3) */
export type AISuggestion = {
  id: string;
  type: AISuggestionType;
  severity: AISeverity;
  /** 0–1 */
  confidence: number;
  title: string;
  message: string;
  targetMeasurementIds?: string[];
  targetBoqItemIds?: string[];
  proposedBoqItem?: Partial<BOQItem>;
  proposedFormula?: string;
  /** ตามสเปก: must be literal true — กันการ auto-apply (Golden Rule #5) */
  requiresUserConfirmation: true;
};

/** สถานะการตอบสนองของผู้ใช้ต่อ suggestion (state-side, ไม่อยู่ใน wire schema) */
export type AISuggestionStatus = 'pending' | 'accepted' | 'rejected';

/** suggestion + status เก็บใน aiStore */
export type AISuggestionRecord = AISuggestion & {
  status: AISuggestionStatus;
  resolvedAt?: string;
  /** ถ้า accept แล้วสร้าง BOQ → เก็บ id ไว้ trace */
  createdBOQItemId?: string;
};
