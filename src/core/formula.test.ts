import { describe, it, expect } from 'vitest';
import { lineQuantity, polygonQuantity, rectQuantity, countQuantity } from './formula';
import type { Pt } from './geometry';

const upp = 0.025; // 200px = 5m

describe('formula → real quantity', () => {
  it('line 200px @0.025 → 5.00 m', () => {
    const pts: Pt[] = [{ x: 0, y: 0 }, { x: 200, y: 0 }];
    expect(lineQuantity(pts, upp)).toBeCloseTo(5);
  });
  it('polygon 8000px² @0.025 → 5.00 m² (ยกกำลังสอง)', () => {
    const r: Pt[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }];
    expect(polygonQuantity(r, upp)).toBeCloseTo(5);
  });
  it('rect 100×80 px @0.025 → 5.00 m²', () => {
    expect(rectQuantity(100, 80, upp)).toBeCloseTo(5);
  });
  it('count 7 → 7', () => { expect(countQuantity(7)).toBe(7); });
});
