import { test, expect } from 'vitest';
import { buildSpecs, specsFromMarks } from './boqAdapter';
import type { MarkDims } from '@/stores/detectionStore';

// buildSlabs (ผ่าน buildSpecs): slab จาก AI ต้องติดธง provisional
test('slab จาก AI → provisional === true', () => {
  const r = buildSpecs({
    extract: [
      { category: 'งานพื้น', name: 'GS', quantity: 100, unit: 'ตร.ม.', dimensions: '0.10' },
    ],
  });
  expect(r.slabs).toHaveLength(1);
  expect(r.slabs[0]!.provisional).toBe(true);
});

const slabDim = (areaSqm: number): MarkDims => ({
  kind: 'slab',
  areaSqm,
  thickness: 0.1,
  meshWireMM: 6,
  meshSpacing: 0.2,
});
const hasAreaWarn = (warnings: string[]) =>
  warnings.some((w) => w.includes('พื้นที่ที่กรอก') && w.includes('เกิน 5%'));

// validator: ต่าง >5% → มี ⚠️
test('tagSum vs areaSqm ต่าง >5% → มี ⚠️', () => {
  const r = specsFromMarks({
    tally: {
      footingByMark: new Map(),
      beamByMark: new Map(),
      slabAreaByMark: new Map([['GS', 100]]),
    },
    markDims: { GS: slabDim(110) },
  });
  expect(hasAreaWarn(r.warnings)).toBe(true);
});

// validator: ต่าง ≤5% → ไม่มี
test('tagSum vs areaSqm ต่าง ≤5% → ไม่มี ⚠️', () => {
  const r = specsFromMarks({
    tally: {
      footingByMark: new Map(),
      beamByMark: new Map(),
      slabAreaByMark: new Map([['GS', 100]]),
    },
    markDims: { GS: slabDim(103) },
  });
  expect(hasAreaWarn(r.warnings)).toBe(false);
});

// validator: tagSum=0 → ไม่มี (ไม่ false positive)
test('tagSum=0 → ไม่มี ⚠️', () => {
  const r = specsFromMarks({
    tally: {
      footingByMark: new Map(),
      beamByMark: new Map(),
      slabAreaByMark: new Map([['GS', 0]]),
    },
    markDims: { GS: slabDim(100) },
  });
  expect(hasAreaWarn(r.warnings)).toBe(false);
});
