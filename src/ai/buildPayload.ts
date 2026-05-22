// src/ai/buildPayload.ts — PURE function: ประกอบ AIReviewRequest จาก state snapshot
// ห้าม import store/React/Konva — รับ state เป็น argument เพื่อให้ test ได้และ swap adapter ง่าย
import type {
  AIMode,
  AIReviewRequest,
  AISelectedRegion,
  BOQItem,
  DrawingPage,
  LengthUnit,
  Measurement,
} from '../types';
import type { BOQItemStored, BOQLinkStored } from '../stores/boqStore';
import { computeBOQViews } from '../stores/boqStore';
import type { ScaleProfile } from '../stores/scaleStore';

export type BuildPayloadInput = {
  requestId: string;
  mode: AIMode;
  project: { id: string; name: string; buildingType?: string };
  activePage: DrawingPage;
  scale: ScaleProfile | null;
  /** measurements **ของหน้า active** เท่านั้น (ส่งไป AI ตามบริบทหน้า) */
  measurementsForPage: Measurement[];
  /** BOQ ของทั้ง project (ไม่ filter หน้า — BOQ เป็น project-wide) */
  boqItemsStored: Record<string, BOQItemStored>;
  boqItemOrder: string[];
  boqLinks: BOQLinkStored[];
  measurementsById: Record<string, Measurement>;
  selectedRegion?: AISelectedRegion;
  userQuestion?: string;
};

/**
 * ประกอบ AIReviewRequest ตรงตาม shape ของ spec §12.2
 * - measurements: array ของ measurement บนหน้า active (ส่งทั้ง object ตาม spec)
 * - boqItems: array ของ BOQItem **view** (มี derived quantity/amount แล้ว — AI ควรเห็นค่าจริง)
 * - scale.unit/unitPerPixel: ถ้าไม่มี profile → fallback unit='m', upp=0 (mark "no scale")
 */
export function buildAIReviewRequest(input: BuildPayloadInput): AIReviewRequest {
  const boqViews: BOQItem[] = computeBOQViews(
    input.boqItemsStored,
    input.boqItemOrder,
    input.boqLinks,
    input.measurementsById,
  );

  const scaleUnit: LengthUnit = input.scale?.unit ?? 'm';
  const upp = input.scale?.unitPerPixel ?? 0;

  const payload: AIReviewRequest = {
    requestId: input.requestId,
    project: {
      id: input.project.id,
      name: input.project.name,
      ...(input.project.buildingType !== undefined && {
        buildingType: input.project.buildingType,
      }),
    },
    drawingContext: {
      drawingPageId: input.activePage.id,
      pageNumber: input.activePage.pageNumber,
      scale: {
        unit: scaleUnit,
        unitPerPixel: upp,
      },
      ...(input.selectedRegion && { selectedRegion: input.selectedRegion }),
    },
    measurements: input.measurementsForPage,
    boqItems: boqViews,
    ...(input.userQuestion !== undefined && { userQuestion: input.userQuestion }),
    mode: input.mode,
  };
  return payload;
}

/** สร้าง requestId แบบ deterministic-prefix + timestamp + random (สำหรับ trace ใน log) */
export function newRequestId(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `ai_${ts}_${rnd}`;
}
