import { test, expect, beforeEach } from 'vitest';
import { useDetectionStore } from './detectionStore';
import type { GridDef } from '@/services/compute/gridModel';

// fixture ขั้นต่ำ — valid ผ่าน type พอ (ลอกจาก gridModel.test.ts page17)
const grid: GridDef = {
  longAxis: ['1', '2'],
  shortAxis: ['A', 'B'],
  intersectionMark: 'F2',
  extras: [{ mark: 'F1', count: 2 }],
};

// แต่ละเคสเริ่มสะอาด
beforeEach(() => useDetectionStore.getState().clearDetection());

test('setGrid → อ่าน grid กลับได้เท่า fixture', () => {
  useDetectionStore.getState().setGrid(grid);
  expect(useDetectionStore.getState().grid).toEqual(grid);
});

test('hydrateDetection({ grid }) → grid เท่า fixture', () => {
  useDetectionStore.getState().hydrateDetection({ grid });
  expect(useDetectionStore.getState().grid).toEqual(grid);
});

// backward-compat: payload เก่าไม่มี grid → ต้อง reset เป็น null
test('hydrateDetection({}) ไม่ส่ง grid → grid = null', () => {
  useDetectionStore.getState().setGrid(grid);
  useDetectionStore.getState().hydrateDetection({});
  expect(useDetectionStore.getState().grid).toBeNull();
});

test('clearDetection → grid = null', () => {
  useDetectionStore.getState().setGrid(grid);
  useDetectionStore.getState().clearDetection();
  expect(useDetectionStore.getState().grid).toBeNull();
});
