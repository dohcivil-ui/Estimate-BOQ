// src/ai/aiService.ts — orchestration ระหว่าง stores → adapter → aiStore
// + accept/reject side-effects (สร้าง BOQ row จาก suggestion โดย user ยืนยัน)
//
// Golden Rule #5: ที่นี่คือ "ที่เดียว" ที่ AI suggestion ทำให้ BOQ เปลี่ยน
//                 — และเปลี่ยนได้ก็ต่อเมื่อ user กด Accept เท่านั้น
import { useDrawingStore } from '../stores/drawingStore';
import { useMeasurementStore, PROJECT_ID } from '../stores/measurementStore';
import { useScaleStore } from '../stores/scaleStore';
import { useBOQStore, defaultFormulaIdFor } from '../stores/boqStore';
import { useAIStore } from '../stores/aiStore';
import type { AIMode, AIReviewRequest, BOQUnit, WorkCategory } from '../types';
import { buildAIReviewRequest, newRequestId } from './buildPayload';
import { MockAIReviewAdapter, type AIReviewAdapter } from './AIReviewAdapter';

// adapter ที่ใช้ใน Phase 5 — MOCK เท่านั้น
// (สลับเป็น RealAdapter ภายหลังโดยเปลี่ยนตัวเดียวที่นี่)
let _adapter: AIReviewAdapter = new MockAIReviewAdapter();
export function setAIReviewAdapter(adapter: AIReviewAdapter) {
  _adapter = adapter;
}

/**
 * รัน AI Review รอบหนึ่ง — สำหรับหน้า active
 * - ครอบ try/catch: ถ้า adapter พัง → aiStore.lastError, ไม่กระทบ measurement/BOQ (§16.1)
 * - return true ถ้าสำเร็จ, false ถ้าไม่มี active page หรือ adapter ล้มเหลว
 */
export async function runAIReview(mode: AIMode = 'boq_review'): Promise<boolean> {
  const drawing = useDrawingStore.getState();
  const page = drawing.pages.find((p) => p.id === drawing.activePageId);
  if (!page) {
    useAIStore.getState().failReview('ไม่มีหน้าแบบที่ active — เปิดไฟล์ก่อน');
    return false;
  }

  const ms = useMeasurementStore.getState();
  const scaleProfile = useScaleStore.getState().byPageId[page.id] ?? null;
  const boq = useBOQStore.getState();

  const measurementsForPage = (ms.byPageId[page.id] ?? [])
    .map((id) => ms.byId[id])
    .filter(<T,>(x: T | undefined): x is T => x !== undefined);

  let req: AIReviewRequest;
  try {
    req = buildAIReviewRequest({
      requestId: newRequestId(),
      mode,
      project: { id: PROJECT_ID, name: PROJECT_ID },
      activePage: page,
      scale: scaleProfile,
      measurementsForPage,
      boqItemsStored: boq.items,
      boqItemOrder: boq.itemOrder,
      boqLinks: boq.links,
      measurementsById: ms.byId,
    });
  } catch (err) {
    useAIStore.getState().failReview(`build payload failed: ${String(err)}`);
    return false;
  }

  useAIStore.getState().beginReview(req);

  try {
    const suggestions = await _adapter.review(req);
    useAIStore.getState().finishReview(suggestions);
    return true;
  } catch (err) {
    // §16.1: AI fail ต้องไม่ทำ core พัง
    useAIStore.getState().failReview(`AI service error: ${String(err)}`);
    return false;
  }
}

/**
 * Accept suggestion — เรียกจาก UI เมื่อ user กด Accept
 * - missing_boq_item: สร้าง BOQ ใหม่ source='ai_suggested' + (ถ้ามี target measurement) auto-link
 * - อื่นๆ: mark accepted เท่านั้น (UI อาจ navigate ผู้ใช้ไปแก้เอง)
 */
export function acceptSuggestion(suggestionId: string): void {
  const ai = useAIStore.getState();
  const sg = ai.suggestions.find((s) => s.id === suggestionId);
  if (!sg) return;
  if (sg.status !== 'pending') return;

  if (sg.type === 'missing_boq_item' && sg.proposedBoqItem) {
    const pb = sg.proposedBoqItem;
    const boq = useBOQStore.getState();
    const newId = boq.createItem({
      code: pb.code ?? 'AI-NEW',
      description: pb.description ?? 'AI suggested item',
      workCategory: (pb.workCategory as WorkCategory) ?? 'other',
      unit: (pb.unit as BOQUnit) ?? 'm',
      unitPrice: pb.unitPrice,
      // **สเปกข้อ 3: source ต้องเป็น 'ai_suggested'** (Phase 5 acceptance)
      source: 'ai_suggested',
    });

    // auto-link measurement target (ถ้ามี) — ใช้ factor 1.0
    const targets = sg.targetMeasurementIds ?? [];
    const measurementsById = useMeasurementStore.getState().byId;
    for (const mid of targets) {
      const m = measurementsById[mid];
      if (!m) continue;
      boq.linkMeasurement(mid, newId, 1, undefined, defaultFormulaIdFor(m));
    }
    ai.markStatus(suggestionId, 'accepted', newId);
    return;
  }

  // ประเภทอื่น: ไม่ทำ side-effect อัตโนมัติ — แค่ mark accepted
  ai.markStatus(suggestionId, 'accepted');
}

/** Reject — เก็บสถานะอย่างเดียว (กัน suggestion เดิมเตือนซ้ำในรอบนี้) */
export function rejectSuggestion(suggestionId: string): void {
  const ai = useAIStore.getState();
  const sg = ai.suggestions.find((s) => s.id === suggestionId);
  if (!sg || sg.status !== 'pending') return;
  ai.markStatus(suggestionId, 'rejected');
}
