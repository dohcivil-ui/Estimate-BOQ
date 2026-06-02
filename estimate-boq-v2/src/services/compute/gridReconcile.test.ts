import { test, expect } from 'vitest';
import { reconcileGridCount } from './gridReconcile';

const m = (o: Record<string, number>) => new Map(Object.entries(o));

test('ตรงกันทุก mark → ok ไม่ติดธง', () => {
  const r = reconcileGridCount(m({ F2: 12, F1: 2 }), m({ F2: 12, F1: 2 }));
  expect(r.ok).toBe(true);
  expect(r.flaggedMarks).toEqual([]);
});

test('แท็กขาด → ติดธง mark นั้น (diff ลบ)', () => {
  const r = reconcileGridCount(m({ F2: 12, F1: 2 }), m({ F2: 10, F1: 2 }));
  expect(r.ok).toBe(false);
  expect(r.flaggedMarks).toEqual(['F2']);
  const f2 = r.diffs.find((d) => d.mark === 'F2')!;
  expect(f2.diff).toBe(-2);
});

test('โค้ดมี mark แต่คนไม่ได้แท็ก → tagged=0 ติดธง', () => {
  const r = reconcileGridCount(m({ F2: 12, F1: 2 }), m({ F2: 12 }));
  expect(r.flaggedMarks).toEqual(['F1']);
  const f1 = r.diffs.find((d) => d.mark === 'F1')!;
  expect(f1).toMatchObject({ enumerated: 2, tagged: 0, diff: -2 });
});

test('คนแท็ก mark ที่โค้ดไม่มี → enumerated=0 ติดธง', () => {
  const r = reconcileGridCount(m({ F2: 12 }), m({ F2: 12, F5: 1 }));
  expect(r.flaggedMarks).toEqual(['F5']);
});

test('tolerance ยอมต่างได้ → ไม่ติดธง', () => {
  const r = reconcileGridCount(m({ F2: 12 }), m({ F2: 13 }), { tolerance: 1 });
  expect(r.ok).toBe(true);
});

test('tolerance ติดลบ → โยน error', () => {
  expect(() => reconcileGridCount(m({ F2: 1 }), m({ F2: 1 }), { tolerance: -1 })).toThrow();
});
