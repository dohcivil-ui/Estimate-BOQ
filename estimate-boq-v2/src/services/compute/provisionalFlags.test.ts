import { test, expect } from 'vitest';
import { buildSpecs } from './boqAdapter';
import { computeFooting } from './footingCompute';
import { computeBeam } from './beamCompute';

// (i) คาน AI path → provisional === true (pieces ว่างเสมอ = ร่าง)
test('คาน AI path → provisional === true', () => {
  const r = buildSpecs({
    extract: [
      { category: 'งานคาน', name: 'GB1', quantity: 2, unit: 'ตัว', dimensions: '0.20 0.40' },
    ],
  });
  expect(r.beams).toHaveLength(1);
  expect(r.beams[0]!.provisional).toBe(true);
});

// (ii) ฐานราก AI path มิติ+จำนวนครบ → provisional ไม่เป็น true
test('ฐานราก AI path มิติ+จำนวนครบ → provisional !== true', () => {
  const r = buildSpecs({
    extract: [
      { category: 'งานฐานราก', name: 'F1', quantity: 2, unit: 'ฐาน', dimensions: '1.50 1.50 0.35' },
    ],
  });
  expect(r.footings).toHaveLength(1);
  expect(r.footings[0]!.provisional).toBe(false);
});

// (iii) ฐานราก AI path มิติไม่ครบ (W/L/T=0) → provisional === true
test('ฐานราก AI path มิติไม่ครบ → provisional === true', () => {
  const r = buildSpecs({
    extract: [
      { category: 'งานฐานราก', name: 'F2', quantity: 2, unit: 'ฐาน', dimensions: '' },
    ],
  });
  expect(r.footings).toHaveLength(1);
  expect(r.footings[0]!.provisional).toBe(true);
});

// (iv) provisional เป็น metadata ล้วน — ไม่กระทบเลขปริมาณ
test('provisional ไม่กระทบผลปริมาณ (footing + beam)', () => {
  const footing = {
    type: 'F1', W: 1.5, L: 1.5, T: 0.35, depth: 1.0, count: 2,
    rebar: [{ size: 'DB12', count: 8, dir: 'both' as const }],
  };
  expect(computeFooting({ ...footing, provisional: true })).toEqual(
    computeFooting({ ...footing, provisional: false }),
  );

  const beam = {
    type: 'GB1', W: 0.2, H: 0.4,
    pieces: [{ length: 4, count: 2 }],
    mainBars: [{ size: 'DB12', count: 4 }],
    stirrup: { size: 'RB6', spacing: 0.15 },
  };
  expect(computeBeam({ ...beam, provisional: true })).toEqual(
    computeBeam({ ...beam, provisional: false }),
  );
});
