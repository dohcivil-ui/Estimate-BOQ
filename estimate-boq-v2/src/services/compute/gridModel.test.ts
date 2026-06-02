import { test, expect } from 'vitest';
import { enumerateGrid, type GridDef } from './gridModel';

// ข้อสอบหน้า 17: grid 1-6 × A-B = 12 (F2) + ฐานพิเศษ F1 ×2 = รวม 14
const page17: GridDef = {
  longAxis: ['1', '2', '3', '4', '5', '6'],
  shortAxis: ['A', 'B'],
  intersectionMark: 'F2',
  extras: [{ mark: 'F1', count: 2, note: 'กึ่งกลางแนว A-B' }],
};

test('หน้า 17: F2=12, F1=2, รวม 14', () => {
  const r = enumerateGrid(page17);
  expect(r.byMark.get('F2')).toBe(12);
  expect(r.byMark.get('F1')).toBe(2);
  expect(r.intersectionTotal).toBe(12);
  expect(r.extraTotal).toBe(2);
  expect(r.total).toBe(14);
});

test('จุดตัดครบ 12 ตำแหน่ง รวม 1A และ 6B', () => {
  const r = enumerateGrid(page17);
  expect(r.positions).toHaveLength(12);
  expect(r.positions).toContain('1A');
  expect(r.positions).toContain('6B');
});

test('grid-first: extras บวกเสมอ ไม่หักจากจุดตัด', () => {
  const more: GridDef = { ...page17, extras: [{ mark: 'F1', count: 2 }, { mark: 'F3', count: 1 }] };
  const r = enumerateGrid(more);
  expect(r.byMark.get('F2')).toBe(12);
  expect(r.total).toBe(15);
});

test('override เปลี่ยนชนิดเฉพาะจุด ไม่เปลี่ยนจำนวนจุดตัดรวม', () => {
  const ov: GridDef = { ...page17, overrides: [{ position: '3A', mark: 'F3' }] };
  const r = enumerateGrid(ov);
  expect(r.byMark.get('F2')).toBe(11);
  expect(r.byMark.get('F3')).toBe(1);
  expect(r.intersectionTotal).toBe(12);
  expect(r.total).toBe(14);
});

test('extras count ติดลบ → โยน error (กฎบวกเท่านั้น)', () => {
  const bad: GridDef = { ...page17, extras: [{ mark: 'F1', count: -2 }] };
  expect(() => enumerateGrid(bad)).toThrow();
});
