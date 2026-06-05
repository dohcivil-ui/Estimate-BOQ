import { test, expect, beforeEach } from 'vitest';
import { useToolStore } from './toolStore';
import type { GridLine } from '@/types/tool';

// fixture: 2 เส้นแกน (page-px) — พอ round-trip persist (inc5)
const lines: GridLine[] = [
  { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } },
  { a: { x: 0, y: 0 }, b: { x: 0, y: 100 }, kind: 'guide' },
];

// แต่ละเคสเริ่มสะอาด
beforeEach(() => useToolStore.getState().clearGridDraft());

test('setGridLines → อ่าน gridLines กลับได้เท่า fixture', () => {
  useToolStore.getState().setGridLines(lines);
  expect(useToolStore.getState().gridLines).toEqual(lines);
});

test('setGridLines แทนที่ทั้งชุด (ไม่ append) + reset selectedGridLine', () => {
  useToolStore.getState().setGridLines(lines);
  useToolStore.getState().setSelectedGridLine(1);
  useToolStore.getState().setGridLines([lines[0]]);
  expect(useToolStore.getState().gridLines).toEqual([lines[0]]);
  expect(useToolStore.getState().selectedGridLine).toBeNull();
});

// hydrate payload เก่า/ว่าง → gridLines = [] (ไม่ throw)
test('setGridLines([]) → gridLines ว่าง', () => {
  useToolStore.getState().setGridLines(lines);
  useToolStore.getState().setGridLines([]);
  expect(useToolStore.getState().gridLines).toEqual([]);
});
