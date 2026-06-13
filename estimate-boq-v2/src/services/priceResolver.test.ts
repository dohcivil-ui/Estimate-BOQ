import { describe, it, expect } from 'vitest';
import { resolvePrices, itemNameMatch } from './priceResolver';
import type { BOQItem } from '@/types/boq';
import type { AdminMaterialPrice } from './adminApi';
import type { LaborPreset } from '@/core/wage809';

const mkItem = (p: Partial<BOQItem>): BOQItem => ({
  id: p.id ?? crypto.randomUUID(),
  category: 'งานโครงสร้าง',
  name: p.name ?? '',
  unit: p.unit ?? 'ลบ.ม.',
  quantity: 1,
  unitPrice: p.unitPrice ?? 0,
  isMaterial: p.isMaterial ?? true,
  wastePct: 0,
  source: 'measurement',
  createdAt: '',
  updatedAt: '',
  ...p,
});

const mat = (item: string, unit: string, price: number): AdminMaterialPrice => ({
  id: crypto.randomUUID(),
  province: 'หนองคาย',
  item,
  unit,
  price,
  source: null,
  fetched_at: null,
  updated_at: '',
});

const labor = (id: string, name: string, unit: LaborPreset['unit'], rate: number): LaborPreset => ({
  id,
  category: 'งานโครงสร้าง',
  name,
  unit,
  rate,
});

describe('resolvePrices — fill-zero only · exact-1 match', () => {
  it('วัสดุ match 1 → fill', () => {
    const items = [mkItem({ name: 'คอนกรีต 240 ksc', unit: 'ลบ.ม.', isMaterial: true, unitPrice: 0 })];
    const r = resolvePrices(items, { materialPrices: [mat('คอนกรีต 240 ksc', 'ลบ.ม.', 2050)], laborPresets: [] });
    expect(r.updates).toEqual([{ id: items[0]!.id, unitPrice: 2050 }]);
    expect(r.filled).toBe(1);
  });

  it('ไม่ทับค่าที่คนแก้ (unitPrice ≠ 0)', () => {
    const items = [mkItem({ name: 'คอนกรีต', unit: 'ลบ.ม.', unitPrice: 1999 })];
    const r = resolvePrices(items, { materialPrices: [mat('คอนกรีต', 'ลบ.ม.', 2050)], laborPresets: [] });
    expect(r.updates).toHaveLength(0);
  });

  it('วัสดุ ไม่เจอ → PRICE_MISSING', () => {
    const items = [mkItem({ name: 'หินเกล็ด', unit: 'ลบ.ม.', unitPrice: 0 })];
    const r = resolvePrices(items, { materialPrices: [], laborPresets: [] });
    expect(r.updates).toHaveLength(0);
    expect(r.warnings[0]).toContain('PRICE_MISSING');
  });

  it('วัสดุ match >1 → PRICE_AMBIGUOUS (ไม่ fill)', () => {
    const items = [mkItem({ name: 'คอนกรีต', unit: 'ลบ.ม.', unitPrice: 0 })];
    const r = resolvePrices(items, {
      materialPrices: [mat('คอนกรีต 240', 'ลบ.ม.', 2050), mat('คอนกรีต 180', 'ลบ.ม.', 1900)],
      laborPresets: [],
    });
    expect(r.updates).toHaveLength(0);
    expect(r.warnings[0]).toContain('PRICE_AMBIGUOUS');
  });

  it('ค่าแรง match 1 (ลบ.ม.) → fill rate', () => {
    const items = [mkItem({ name: 'เทคอนกรีตผสมเสร็จ — อาคารชั้นเดียว', unit: 'ลบ.ม.', isMaterial: false, unitPrice: 0 })];
    const r = resolvePrices(items, {
      materialPrices: [],
      laborPresets: [labor('c1', 'เทคอนกรีตผสมเสร็จ — อาคารชั้นเดียว', 'ลบ.ม.', 421)],
    });
    expect(r.updates).toEqual([{ id: items[0]!.id, unitPrice: 421 }]);
  });

  it('ค่าแรงหน่วยที่ ว.809 ไม่คิดที่ BOQ (เหล็ก กก.) → ข้ามเงียบ ไม่ warn', () => {
    const items = [mkItem({ name: 'เหล็กเสริม DB12 (ค่าแรง)', unit: 'กก.', isMaterial: false, unitPrice: 0 })];
    const r = resolvePrices(items, {
      materialPrices: [],
      laborPresets: [labor('rb', 'เหล็กเสริม Ø 10–16 มม.', 'ตัน', 3900)],
    });
    expect(r.updates).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });
});

describe('itemNameMatch', () => {
  it('match สองทาง', () => {
    expect(itemNameMatch('คอนกรีต 240 ksc', 'คอนกรีต')).toBe(true);
    expect(itemNameMatch('ทราย', 'หิน')).toBe(false);
  });
});
