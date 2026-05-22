// src/ai/AIReviewAdapter.ts — AI service layer (spec §12)
// ออกแบบเป็น interface เพื่อให้สลับ Mock ↔ Real ได้โดยไม่รื้อ UI
// Phase 5 = MOCK เท่านั้น (ห้ามต่อ service จริง)
import type {
  AIReviewRequest,
  AISuggestion,
  AISuggestionType,
  BOQItem,
  Measurement,
} from '../types';

export interface AIReviewAdapter {
  /** ส่ง payload → คืน suggestions (อาจ throw ได้ — caller ต้อง catch — §16.1) */
  review(request: AIReviewRequest): Promise<AISuggestion[]>;
}

/** จำลอง latency เล็กน้อยเพื่อให้ UX เห็นว่ามีการ "ส่ง" */
const MOCK_LATENCY_MS = 250;

let _suggSeq = 0;
function nextSuggestionId(): string {
  _suggSeq += 1;
  return `sugg_${Date.now().toString(36)}_${_suggSeq.toString(36)}`;
}

/**
 * MockAIReviewAdapter — production-shaped mock
 * กฎที่ใช้ออก suggestion (deterministic จาก payload):
 *  1. measurement ที่ confirmed แต่ไม่มี BOQ link → 'missing_boq_item'
 *  2. BOQ item ที่ source='measurement' หรือ 'ai_suggested' แต่ quantity=0 → 'quantity_anomaly'
 *  3. BOQ items ที่มี code ซ้ำกัน → 'duplicate_item'
 *  4. ทุก BOQ item ที่ไม่มี unitPrice → 'category_suggestion' (เสนอให้กรอกราคา)
 *  5. ถ้าไม่พบอะไรเลย → 'explanation' ว่า "ทุกอย่างดูเรียบร้อย" (severity=info)
 */
export class MockAIReviewAdapter implements AIReviewAdapter {
  async review(request: AIReviewRequest): Promise<AISuggestion[]> {
    await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
    return mockSuggestionsFor(request);
  }
}

/** Pure rule evaluator — แยกออกมาเพื่อเทสได้ */
export function mockSuggestionsFor(req: AIReviewRequest): AISuggestion[] {
  const suggestions: AISuggestion[] = [];

  // ใช้ measurement.id ที่อยู่ใน links ทุกอันรวมกัน → "set ของ measurement ที่ผูกแล้ว"
  const linkedMeasurementIds = new Set<string>();
  for (const b of req.boqItems) {
    for (const l of b.links) linkedMeasurementIds.add(l.measurementId);
  }

  // 1) orphan measurements → missing_boq_item
  const orphans: Measurement[] = req.measurements.filter(
    (m) => m.status === 'confirmed' && !linkedMeasurementIds.has(m.id),
  );
  for (const m of orphans) {
    const labelText = m.label?.trim() ? m.label : describeMeasurement(m);
    suggestions.push({
      id: nextSuggestionId(),
      type: 'missing_boq_item',
      severity: 'warning',
      confidence: 0.7,
      title: `Measurement ยังไม่ผูก BOQ: ${labelText}`,
      message:
        `measurement ${labelText} (${formatQuantity(m)}) บนหน้าที่ ${req.drawingContext.pageNumber} ` +
        `ยังไม่ได้ผูกกับ BOQ — เสนอให้สร้างรายการ BOQ ใหม่จาก measurement นี้`,
      targetMeasurementIds: [m.id],
      proposedBoqItem: {
        code: suggestCodeFor(m),
        description: labelText,
        workCategory: 'other',
        unit: m.unit,
        source: 'ai_suggested',
      },
      proposedFormula: m.type === 'count_marker' ? 'count' : `${m.type}_default`,
      requiresUserConfirmation: true,
    });
  }

  // 2) zero-quantity BOQ that should have something → quantity_anomaly
  for (const b of req.boqItems) {
    if ((b.source === 'measurement' || b.source === 'ai_suggested') && b.quantity === 0) {
      suggestions.push({
        id: nextSuggestionId(),
        type: 'quantity_anomaly',
        severity: 'critical',
        confidence: 0.85,
        title: `BOQ "${b.code}" ปริมาณเป็น 0`,
        message:
          `รายการ BOQ "${b.code}" (${b.description}) มี quantity = 0 ` +
          `แม้ source='${b.source}' — อาจเกิดจาก measurement ที่ผูกถูกลบ ` +
          `หรือ link ทั้งหมดถูกตัดออก — กรุณาตรวจสอบ`,
        targetBoqItemIds: [b.id],
        requiresUserConfirmation: true,
      });
    }
  }

  // 3) duplicate code → duplicate_item
  const codeGroups = new Map<string, BOQItem[]>();
  for (const b of req.boqItems) {
    const key = b.code.trim().toUpperCase();
    if (!key) continue;
    const arr = codeGroups.get(key) ?? [];
    arr.push(b);
    codeGroups.set(key, arr);
  }
  for (const [code, group] of codeGroups) {
    if (group.length < 2) continue;
    suggestions.push({
      id: nextSuggestionId(),
      type: 'duplicate_item',
      severity: 'warning',
      confidence: 0.95,
      title: `รหัส BOQ ซ้ำ: ${code} (${group.length} รายการ)`,
      message:
        `พบ BOQ ${group.length} รายการที่ใช้รหัส "${code}" — แนะนำให้รวมเป็นรายการเดียว ` +
        `หรือเปลี่ยนรหัสให้ unique`,
      targetBoqItemIds: group.map((g) => g.id),
      requiresUserConfirmation: true,
    });
  }

  // 4) missing unitPrice → category_suggestion (เสนอเติมราคา)
  const missingPriceItems = req.boqItems.filter((b) => b.unitPrice == null);
  if (missingPriceItems.length > 0) {
    suggestions.push({
      id: nextSuggestionId(),
      type: 'category_suggestion',
      severity: 'info',
      confidence: 0.5,
      title: `${missingPriceItems.length} BOQ ยังไม่มี unit price`,
      message:
        `BOQ items เหล่านี้ยังไม่มีราคาต่อหน่วย — กรอกราคาในตาราง BOQ เพื่อคำนวณ amount: ` +
        missingPriceItems.map((b) => b.code).join(', '),
      targetBoqItemIds: missingPriceItems.map((b) => b.id),
      requiresUserConfirmation: true,
    });
  }

  // 5) ถ้าไม่พบอะไรเลย → explanation info
  if (suggestions.length === 0) {
    suggestions.push({
      id: nextSuggestionId(),
      type: 'explanation',
      severity: 'info',
      confidence: 0.9,
      title: 'ตรวจสอบเสร็จ ไม่พบความผิดปกติ',
      message:
        `ตรวจ ${req.measurements.length} measurement และ ${req.boqItems.length} BOQ item ` +
        `บนหน้า ${req.drawingContext.pageNumber} — ทุก measurement ผูก BOQ ครบ และไม่มี quantity ผิดปกติ`,
      requiresUserConfirmation: true,
    });
  }

  return suggestions;
}

function describeMeasurement(m: Measurement): string {
  switch (m.type) {
    case 'line':
      return 'เส้นวัด';
    case 'polyline':
      return 'เส้นวัดต่อเนื่อง';
    case 'polygon_area':
    case 'lasso_area':
      return 'พื้นที่ polygon';
    case 'rectangle_area':
    case 'region_selection':
      return 'พื้นที่สี่เหลี่ยม';
    case 'count_marker':
      return `count ${m.categoryId ?? ''}`.trim();
    default:
      return m.type;
  }
}

function formatQuantity(m: Measurement): string {
  const u = m.unit === 'm2' ? 'm²' : m.unit;
  const fix = m.unit === 'ea' || m.unit === 'set' ? 0 : 3;
  return `${m.quantity.toFixed(fix)} ${u}`;
}

function suggestCodeFor(m: Measurement): string {
  const prefix =
    m.type === 'count_marker' && m.categoryId
      ? m.categoryId.toUpperCase()
      : m.type === 'line' || m.type === 'polyline'
        ? 'AI-L'
        : 'AI-A';
  const short = m.id.slice(-4).toUpperCase();
  return `${prefix}-${short}`;
}

/** Suggestion type label สำหรับ UI */
export const SUGGESTION_TYPE_LABEL: Record<AISuggestionType, string> = {
  missing_boq_item: 'BOQ ที่ขาด',
  quantity_anomaly: 'Quantity ผิดปกติ',
  duplicate_item: 'รายการซ้ำ',
  category_suggestion: 'เสนอ category',
  formula_suggestion: 'เสนอ formula',
  explanation: 'คำอธิบาย',
};
