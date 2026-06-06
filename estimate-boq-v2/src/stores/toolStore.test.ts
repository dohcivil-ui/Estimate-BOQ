import { test, expect, beforeEach } from 'vitest';
import { useToolStore } from './toolStore';
import type { GridLine, DimLine } from '@/types/tool';

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

// ── dimensions (R1-C8) — มิเรอร์ gridLines ────────────────────────
const dimLines: DimLine[] = [
  { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, valueM: 4 },
  { a: { x: 0, y: 0 }, b: { x: 0, y: 50 }, valueM: null },
];

test('setDimLines → อ่าน dimensions กลับได้เท่า fixture', () => {
  useToolStore.getState().setDimLines(dimLines);
  expect(useToolStore.getState().dimensions).toEqual(dimLines);
});

test('setDimLines แทนที่ทั้งชุด (ไม่ append) + reset selectedDimLine', () => {
  useToolStore.getState().setDimLines(dimLines);
  useToolStore.getState().setSelectedDimLine(1);
  useToolStore.getState().setDimLines([dimLines[0]]);
  expect(useToolStore.getState().dimensions).toEqual([dimLines[0]]);
  expect(useToolStore.getState().selectedDimLine).toBeNull();
});

test('addDimLine → ต่อท้าย (ไม่แทนที่)', () => {
  useToolStore.getState().setDimLines([dimLines[0]]);
  useToolStore.getState().addDimLine(dimLines[1]);
  expect(useToolStore.getState().dimensions).toEqual(dimLines);
});

test('setDimValue → แก้เฉพาะเส้น i (human-only) ไม่กระทบเส้นอื่น', () => {
  useToolStore.getState().setDimLines(dimLines);
  useToolStore.getState().setDimValue(1, 2.5);
  expect(useToolStore.getState().dimensions[1].valueM).toBe(2.5);
  expect(useToolStore.getState().dimensions[0].valueM).toBe(4);
});

test('removeDimLine → ลบเส้น i + reset selectedDimLine', () => {
  useToolStore.getState().setDimLines(dimLines);
  useToolStore.getState().setSelectedDimLine(0);
  useToolStore.getState().removeDimLine(0);
  expect(useToolStore.getState().dimensions).toEqual([dimLines[1]]);
  expect(useToolStore.getState().selectedDimLine).toBeNull();
});

test('setDimLines([]) → dimensions ว่าง', () => {
  useToolStore.getState().setDimLines(dimLines);
  useToolStore.getState().setDimLines([]);
  expect(useToolStore.getState().dimensions).toEqual([]);
});
