import { describe, it, expect } from 'vitest';
import { distancePx, polylineLengthPx, polygonAreaPx2, type Pt } from './geometry';

describe('geometry', () => {
  it('distance 3-4-5 ×40 → 200', () => {
    expect(distancePx({ x: 0, y: 0 }, { x: 120, y: 160 })).toBeCloseTo(200);
  });
  it('polyline 2 ช่วง ช่วงละ 200 → 400', () => {
    const pts: Pt[] = [{ x: 0, y: 0 }, { x: 120, y: 160 }, { x: 120, y: 360 }];
    expect(polylineLengthPx(pts)).toBeCloseTo(400);
  });
  it('shoelace สี่เหลี่ยม 100×80 → 8000', () => {
    const r: Pt[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }];
    expect(polygonAreaPx2(r)).toBeCloseTo(8000);
  });
  it('shoelace สามเหลี่ยม 40×40 → 800', () => {
    const t: Pt[] = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 40 }];
    expect(polygonAreaPx2(t)).toBeCloseTo(800);
  });
  it('CW = CCW (ไม่ขึ้นกับทิศ)', () => {
    const cw: Pt[] = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 40 }];
    expect(polygonAreaPx2([...cw].reverse())).toBeCloseTo(polygonAreaPx2(cw));
  });
});
