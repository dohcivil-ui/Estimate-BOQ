// src/ai/AIReviewAdapter.test.ts — mock adapter rule evaluator (PURE)
import { describe, it, expect } from 'vitest';
import { mockSuggestionsFor } from './AIReviewAdapter';
import type { AIReviewRequest, BOQItem, Measurement } from '../types';

function makeMeasurement(id: string, q: number, label?: string): Measurement {
  return {
    id,
    projectId: 'p',
    drawingPageId: 'page-1',
    type: 'line',
    geometry: { kind: 'line', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
    quantity: q,
    unit: 'm',
    scaleId: 'page-1',
    status: 'confirmed',
    boqLinks: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...(label !== undefined && { label }),
  };
}

function makeBOQItem(
  id: string,
  code: string,
  opts: { source?: BOQItem['source']; quantity?: number; unitPrice?: number } = {},
): BOQItem {
  return {
    id,
    projectId: 'p',
    code,
    description: 'd',
    workCategory: 'architecture',
    unit: 'm',
    quantity: opts.quantity ?? 0,
    unitPrice: opts.unitPrice,
    amount: opts.unitPrice != null ? (opts.quantity ?? 0) * opts.unitPrice : undefined,
    source: opts.source ?? 'manual',
    links: [],
  };
}

function makeRequest(opts: { measurements?: Measurement[]; boqItems?: BOQItem[] } = {}): AIReviewRequest {
  return {
    requestId: 'r',
    project: { id: 'p', name: 'p' },
    drawingContext: {
      drawingPageId: 'page-1',
      pageNumber: 1,
      scale: { unit: 'm', unitPerPixel: 0.05 },
    },
    measurements: opts.measurements ?? [],
    boqItems: opts.boqItems ?? [],
    mode: 'boq_review',
  };
}

describe('MockAIReviewAdapter rules', () => {
  it('orphan measurement → suggestion missing_boq_item พร้อม proposedBoqItem.source = ai_suggested', () => {
    const m = makeMeasurement('m1', 5, 'ผนัง A');
    const req = makeRequest({ measurements: [m] });
    const suggs = mockSuggestionsFor(req);
    const orphan = suggs.find((s) => s.type === 'missing_boq_item');
    expect(orphan).toBeDefined();
    expect(orphan!.targetMeasurementIds).toContain('m1');
    expect(orphan!.proposedBoqItem?.source).toBe('ai_suggested');
    expect(orphan!.proposedBoqItem?.unit).toBe('m');
    expect(orphan!.requiresUserConfirmation).toBe(true);
  });

  it('measurement ที่ผูก BOQ แล้ว → ไม่มี missing_boq_item สำหรับมัน', () => {
    const m = makeMeasurement('m1', 5);
    const b = makeBOQItem('b1', 'X');
    b.links = [
      {
        id: 'l1',
        measurementId: 'm1',
        boqItemId: 'b1',
        formulaId: 'line_length',
        factor: 1,
        quantityContribution: 5,
      },
    ];
    const req = makeRequest({ measurements: [m], boqItems: [b] });
    const suggs = mockSuggestionsFor(req);
    expect(suggs.find((s) => s.type === 'missing_boq_item' && s.targetMeasurementIds?.includes('m1'))).toBeUndefined();
  });

  it('BOQ source=measurement quantity=0 → quantity_anomaly severity=critical', () => {
    const b = makeBOQItem('b1', 'X', { source: 'measurement', quantity: 0 });
    const req = makeRequest({ boqItems: [b] });
    const suggs = mockSuggestionsFor(req);
    const anom = suggs.find((s) => s.type === 'quantity_anomaly');
    expect(anom).toBeDefined();
    expect(anom!.severity).toBe('critical');
    expect(anom!.targetBoqItemIds).toEqual(['b1']);
  });

  it('BOQ code ซ้ำ → duplicate_item ครอบทุก id', () => {
    const a = makeBOQItem('b1', 'DUP-1');
    const b = makeBOQItem('b2', 'DUP-1');
    const c = makeBOQItem('b3', 'OTHER');
    const req = makeRequest({ boqItems: [a, b, c] });
    const suggs = mockSuggestionsFor(req);
    const dup = suggs.find((s) => s.type === 'duplicate_item');
    expect(dup).toBeDefined();
    expect(dup!.targetBoqItemIds).toEqual(['b1', 'b2']);
  });

  it('BOQ ไม่มี unitPrice → category_suggestion (info)', () => {
    const a = makeBOQItem('b1', 'X1');
    const b = makeBOQItem('b2', 'X2', { unitPrice: 100 });
    const req = makeRequest({ boqItems: [a, b] });
    const suggs = mockSuggestionsFor(req);
    const cat = suggs.find((s) => s.type === 'category_suggestion');
    expect(cat).toBeDefined();
    expect(cat!.severity).toBe('info');
    expect(cat!.targetBoqItemIds).toEqual(['b1']);
  });

  it('ไม่มีอะไรผิด → explanation 1 ข้อ severity=info', () => {
    // measurement ผูก BOQ + BOQ มี unitPrice + ไม่มีปัญหา
    const m = makeMeasurement('m1', 5);
    const b = makeBOQItem('b1', 'OK', { unitPrice: 100, quantity: 5, source: 'measurement' });
    b.links = [
      {
        id: 'l1',
        measurementId: 'm1',
        boqItemId: 'b1',
        formulaId: 'line_length',
        factor: 1,
        quantityContribution: 5,
      },
    ];
    const req = makeRequest({ measurements: [m], boqItems: [b] });
    const suggs = mockSuggestionsFor(req);
    expect(suggs.filter((s) => s.severity !== 'info')).toHaveLength(0);
    expect(suggs.find((s) => s.type === 'explanation')).toBeDefined();
  });

  it('ทุก suggestion ต้องมี requiresUserConfirmation = true (Golden Rule #5)', () => {
    const m = makeMeasurement('m1', 5);
    const a = makeBOQItem('b1', 'DUP-1', { source: 'measurement', quantity: 0 });
    const b = makeBOQItem('b2', 'DUP-1');
    const req = makeRequest({ measurements: [m], boqItems: [a, b] });
    const suggs = mockSuggestionsFor(req);
    for (const s of suggs) {
      expect(s.requiresUserConfirmation).toBe(true);
    }
  });
});
