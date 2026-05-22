// src/ai/buildPayload.test.ts — verify ว่า payload shape ตรงสเปก §12.2
import { describe, it, expect } from 'vitest';
import { buildAIReviewRequest, newRequestId } from './buildPayload';
import type { DrawingPage, Measurement } from '../types';
import type { BOQItemStored, BOQLinkStored } from '../stores/boqStore';

function makePage(): DrawingPage {
  return {
    id: 'page-1',
    fileId: 'file-1',
    pageNumber: 1,
    pageWidth: 1000,
    pageHeight: 800,
    renderScale: 2,
    bitmap: null,
    thumbnailDataUrl: null,
    measurementCount: 0,
  };
}

function makeMeasurement(id: string, q: number): Measurement {
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
  };
}

function makeBOQItem(id: string, unitPrice?: number): BOQItemStored {
  return {
    id,
    projectId: 'p',
    code: 'CODE-' + id,
    description: 'desc',
    workCategory: 'architecture',
    unit: 'm',
    unitPrice,
    source: 'manual',
  };
}

describe('buildAIReviewRequest — shape ตรง spec §12.2', () => {
  const m1 = makeMeasurement('m1', 10);
  const page = makePage();

  it('field ที่ต้องมีตามสเปก ครบ', () => {
    const payload = buildAIReviewRequest({
      requestId: 'req-1',
      mode: 'boq_review',
      project: { id: 'proj', name: 'Test Project' },
      activePage: page,
      scale: {
        pageId: 'page-1',
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 0 },
        pixelDistance: 100,
        realDistance: 5,
        unit: 'm',
        unitPerPixel: 0.05,
        pixelPerUnit: 20,
        createdAt: '2024-01-01T00:00:00Z',
      },
      measurementsForPage: [m1],
      boqItemsStored: {},
      boqItemOrder: [],
      boqLinks: [],
      measurementsById: { m1 },
    });

    expect(payload.requestId).toBe('req-1');
    expect(payload.project).toEqual({ id: 'proj', name: 'Test Project' });
    expect(payload.drawingContext.drawingPageId).toBe('page-1');
    expect(payload.drawingContext.pageNumber).toBe(1);
    expect(payload.drawingContext.scale).toEqual({ unit: 'm', unitPerPixel: 0.05 });
    expect(payload.measurements).toHaveLength(1);
    expect(payload.measurements[0]!.id).toBe('m1');
    expect(payload.boqItems).toEqual([]);
    expect(payload.mode).toBe('boq_review');
    expect(payload.userQuestion).toBeUndefined();
    expect(payload.drawingContext.selectedRegion).toBeUndefined();
  });

  it('boqItems ใช้ DERIVED view (มี quantity ที่คำนวณจาก links)', () => {
    const item = makeBOQItem('b1', 100);
    const link: BOQLinkStored = {
      id: 'l1',
      measurementId: 'm1',
      boqItemId: 'b1',
      formulaId: 'line_length',
      factor: 2,
    };
    const payload = buildAIReviewRequest({
      requestId: 'r',
      mode: 'boq_review',
      project: { id: 'p', name: 'p' },
      activePage: page,
      scale: null,
      measurementsForPage: [m1],
      boqItemsStored: { b1: item },
      boqItemOrder: ['b1'],
      boqLinks: [link],
      measurementsById: { m1 },
    });
    expect(payload.boqItems).toHaveLength(1);
    expect(payload.boqItems[0]!.quantity).toBeCloseTo(10 * 2);
    expect(payload.boqItems[0]!.amount).toBeCloseTo(10 * 2 * 100);
    expect(payload.boqItems[0]!.links).toHaveLength(1);
  });

  it('ไม่มี scale → fallback unit=m, unitPerPixel=0', () => {
    const payload = buildAIReviewRequest({
      requestId: 'r',
      mode: 'boq_review',
      project: { id: 'p', name: 'p' },
      activePage: page,
      scale: null,
      measurementsForPage: [],
      boqItemsStored: {},
      boqItemOrder: [],
      boqLinks: [],
      measurementsById: {},
    });
    expect(payload.drawingContext.scale).toEqual({ unit: 'm', unitPerPixel: 0 });
  });

  it('selectedRegion จะปรากฏก็ต่อเมื่อใส่ input — ไม่ใส่ key เปล่าทิ้งไว้', () => {
    const payload = buildAIReviewRequest({
      requestId: 'r',
      mode: 'region_analyze',
      project: { id: 'p', name: 'p' },
      activePage: page,
      scale: null,
      measurementsForPage: [],
      boqItemsStored: {},
      boqItemOrder: [],
      boqLinks: [],
      measurementsById: {},
      selectedRegion: {
        geometry: { kind: 'rectangle', x: 0, y: 0, width: 100, height: 100 },
      },
    });
    expect(payload.drawingContext.selectedRegion).toBeDefined();
    expect(payload.drawingContext.selectedRegion!.geometry.kind).toBe('rectangle');
  });

  it('mode รองรับทั้ง 4 ตามสเปก', () => {
    const modes = ['boq_review', 'suggest_items', 'explain_quantity', 'region_analyze'] as const;
    for (const mode of modes) {
      const p = buildAIReviewRequest({
        requestId: 'r',
        mode,
        project: { id: 'p', name: 'p' },
        activePage: page,
        scale: null,
        measurementsForPage: [],
        boqItemsStored: {},
        boqItemOrder: [],
        boqLinks: [],
        measurementsById: {},
      });
      expect(p.mode).toBe(mode);
    }
  });
});

describe('newRequestId', () => {
  it('ขึ้นต้น ai_ และไม่ซ้ำกันในระยะใกล้', () => {
    const a = newRequestId();
    const b = newRequestId();
    expect(a.startsWith('ai_')).toBe(true);
    expect(b.startsWith('ai_')).toBe(true);
    expect(a).not.toBe(b);
  });
});
