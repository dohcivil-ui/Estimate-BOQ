import { test, expect } from 'vitest';
import { buildBOQ, type MemberCountInput } from './buildBOQ';
import type { GridDef } from './gridModel';

// grid หน้า 17: F2×12 (จุดตัด) + F1×2 (พิเศษ)
const page17: GridDef = {
  longAxis: ['1', '2', '3', '4', '5', '6'],
  shortAxis: ['A', 'B'],
  intersectionMark: 'F2',
  extras: [{ mark: 'F1', count: 2 }],
};

const members = (counts: Record<string, number>): MemberCountInput[] => {
  const out: MemberCountInput[] = [];
  for (const [mark, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) out.push({ mark, status: 'confirmed' });
  }
  return out;
};

const hasFlag = (warnings: string[], mark: string) =>
  warnings.some((w) => w.startsWith('🚩') && w.includes(mark));

// แท็กขาด 2 ฐาน F2 → 🚩 F2 (grid 12 vs tag 10)
test('grid ≠ tag → 🚩 ระบุ mark + เลขสองฝั่ง', () => {
  const r = buildBOQ({ extract: [], members: members({ F2: 10, F1: 2 }), grid: page17 });
  expect(hasFlag(r.warnings, 'F2')).toBe(true);
  expect(r.warnings.some((w) => w.includes('grid นับได้ 12') && w.includes('ระบายบนแบบ 10'))).toBe(true);
  expect(hasFlag(r.warnings, 'F1')).toBe(false);
});

// แท็กตรง grid ทุก mark → ไม่มี 🚩
test('grid = tag → ไม่มี 🚩', () => {
  const r = buildBOQ({ extract: [], members: members({ F2: 12, F1: 2 }), grid: page17 });
  expect(r.warnings.some((w) => w.startsWith('🚩'))).toBe(false);
});

// ไม่ส่ง grid → ไม่ reconcile (ไม่มี 🚩)
test('ไม่ส่ง grid → ไม่มี 🚩', () => {
  const r = buildBOQ({ extract: [], members: members({ F2: 10, F1: 2 }) });
  expect(r.warnings.some((w) => w.startsWith('🚩'))).toBe(false);
});

// ส่ง grid แต่ไม่มี members → ไม่มี tally → ไม่ reconcile
test('grid แต่ไม่มี members → ไม่มี 🚩', () => {
  const r = buildBOQ({ extract: [], grid: page17 });
  expect(r.warnings.some((w) => w.startsWith('🚩'))).toBe(false);
});

// grid กรอกตัวพิมพ์เล็ก/มีช่องว่าง ("f2") ต้อง match tag UPPER ("F2") → ไม่ใช่ธงปลอม
test('grid mixed-case "f2" = tag "F2" ครบ → ไม่มี 🚩 (normalize UPPER)', () => {
  const lowerGrid: GridDef = {
    longAxis: ['1', '2', '3', '4', '5', '6'],
    shortAxis: ['A', 'B'],
    intersectionMark: ' f2 ',
    extras: [{ mark: 'f1', count: 2 }],
  };
  const r = buildBOQ({ extract: [], members: members({ F2: 12, F1: 2 }), grid: lowerGrid });
  expect(r.warnings.some((w) => w.startsWith('🚩'))).toBe(false);
});

// grid "f2" (เล็ก) vs tag ขาด → ยังติดธง และ mark ในธงเป็น UPPER "F2"
test('grid mixed-case "f2" vs tag ขาด → 🚩 mark UPPER', () => {
  const lowerGrid: GridDef = {
    longAxis: ['1', '2', '3', '4', '5', '6'],
    shortAxis: ['A', 'B'],
    intersectionMark: 'f2',
  };
  const r = buildBOQ({ extract: [], members: members({ F2: 10 }), grid: lowerGrid });
  expect(hasFlag(r.warnings, 'F2')).toBe(true);
});

// grid invalid (longAxis ว่าง → enumerateGrid throw) → ⚠️ ข้าม ไม่แครช ไม่มี 🚩
test('grid invalid → ⚠️ ข้ามการเทียบ ไม่ throw + ไม่มี 🚩', () => {
  const badGrid: GridDef = { ...page17, longAxis: [] };
  const r = buildBOQ({ extract: [], members: members({ F2: 12, F1: 2 }), grid: badGrid });
  expect(r.warnings.some((w) => w.startsWith('⚠️'))).toBe(true);
  expect(r.warnings.some((w) => w.startsWith('🚩'))).toBe(false);
});
