// src/stores/boqStore.test.ts — tests สำหรับ DERIVED BOQ selector
// (วาง test ไว้คู่ store เพราะ logic ทั้งหมดเป็น PURE function — ไม่ต้อง mount React)
import { describe, it, expect } from 'vitest';
import {
  computeContribution,
  computeBOQView,
  computeBOQViews,
} from './boqStore';
import type { BOQItemStored, BOQLinkStored } from './boqStore';
import type { Measurement } from '../types';

function makeMeasurement(id: string, quantity: number, unit: Measurement['unit'] = 'm'): Measurement {
  return {
    id,
    projectId: 'p',
    drawingPageId: 'page1',
    type: 'line',
    geometry: { kind: 'line', points: [{ x: 0, y: 0 }, { x: 0, y: 0 }] },
    quantity,
    unit,
    scaleId: 'page1',
    status: 'confirmed',
    boqLinks: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function makeItem(id: string, unit: BOQItemStored['unit'] = 'm', unitPrice?: number): BOQItemStored {
  return {
    id,
    projectId: 'p',
    code: 'X',
    description: 'item',
    workCategory: 'architecture',
    unit,
    unitPrice,
    source: 'measurement',
  };
}

function makeLink(id: string, measurementId: string, boqItemId: string, factor: number, wasteFactor?: number): BOQLinkStored {
  return { id, measurementId, boqItemId, factor, wasteFactor, formulaId: 'line_length' };
}

describe('computeContribution — DERIVED', () => {
  it('contribution = m.quantity × factor × (1 + wasteFactor)', () => {
    const m = makeMeasurement('m1', 10);
    const link = makeLink('lnk', 'm1', 'b1', 2, 0.05);
    expect(computeContribution(link, { m1: m })).toBeCloseTo(10 * 2 * 1.05);
  });
  it('wasteFactor ไม่ส่ง → ถือเป็น 0', () => {
    const m = makeMeasurement('m1', 10);
    const link = makeLink('lnk', 'm1', 'b1', 3);
    expect(computeContribution(link, { m1: m })).toBeCloseTo(30);
  });
  it('orphan link (measurement หาย) → contribution = 0', () => {
    const link = makeLink('lnk', 'gone', 'b1', 5);
    expect(computeContribution(link, {})).toBe(0);
  });
});

describe('computeBOQView — DERIVED quantity & amount', () => {
  it('1 measurement → 1 BOQ: quantity = contribution; amount = qty × unitPrice', () => {
    const m = makeMeasurement('m1', 4); // เส้น 4 m
    const item = makeItem('b1', 'm2', 350); // ก่อผนัง 350 บาท/m²
    const link = makeLink('lnk', 'm1', 'b1', 2.7); // factor = wall height
    const view = computeBOQView(item, [link], { m1: m });
    expect(view.quantity).toBeCloseTo(4 * 2.7);
    expect(view.amount).toBeCloseTo(4 * 2.7 * 350);
    expect(view.links).toHaveLength(1);
    expect(view.links[0]!.quantityContribution).toBeCloseTo(4 * 2.7);
  });

  it('หลาย measurement → 1 BOQ: รวมยอด (Σ contribution)', () => {
    const m1 = makeMeasurement('m1', 3);
    const m2 = makeMeasurement('m2', 5);
    const item = makeItem('b1', 'm2');
    const link1 = makeLink('lnk1', 'm1', 'b1', 2);
    const link2 = makeLink('lnk2', 'm2', 'b1', 2);
    const view = computeBOQView(item, [link1, link2], { m1, m2 });
    expect(view.quantity).toBeCloseTo(3 * 2 + 5 * 2);
    // ไม่มี unitPrice → amount = undefined (ไม่ใช่ 0)
    expect(view.amount).toBeUndefined();
  });

  it('แก้ measurement → quantity ของ view เปลี่ยนทันที (recompute เสมอ)', () => {
    const item = makeItem('b1', 'm');
    const link = makeLink('lnk', 'm1', 'b1', 1);
    const v1 = computeBOQView(item, [link], { m1: makeMeasurement('m1', 10) });
    const v2 = computeBOQView(item, [link], { m1: makeMeasurement('m1', 25) });
    expect(v1.quantity).toBe(10);
    expect(v2.quantity).toBe(25);
  });

  it('unitPrice = 0 → amount = 0 (ไม่ใช่ undefined)', () => {
    const item = makeItem('b1', 'm', 0);
    const link = makeLink('lnk', 'm1', 'b1', 1);
    const v = computeBOQView(item, [link], { m1: makeMeasurement('m1', 5) });
    expect(v.amount).toBe(0);
  });

  it('item ไม่มี link → quantity = 0, amount undefined ถ้าไม่มี unitPrice', () => {
    const item = makeItem('b1', 'm2');
    const v = computeBOQView(item, [], {});
    expect(v.quantity).toBe(0);
    expect(v.amount).toBeUndefined();
    expect(v.links).toEqual([]);
  });
});

describe('computeBOQViews — order + filtering', () => {
  it('คืนเรียงตาม itemOrder', () => {
    const a = makeItem('a');
    const b = makeItem('b');
    const c = makeItem('c');
    const views = computeBOQViews({ a, b, c }, ['b', 'a', 'c'], [], {});
    expect(views.map((v) => v.id)).toEqual(['b', 'a', 'c']);
  });
  it('itemOrder ที่ชี้ไป id ไม่มีอยู่ → ข้าม (ไม่ throw)', () => {
    const a = makeItem('a');
    const views = computeBOQViews({ a }, ['a', 'ghost'], [], {});
    expect(views.map((v) => v.id)).toEqual(['a']);
  });
});
