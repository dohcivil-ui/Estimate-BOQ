// src/core/hittest.test.ts — seed tests สำหรับ hittest.ts
// ค่าที่ใช้พิสูจน์ได้ด้วยมือ (ระยะตรง / สมมาตร / ภายในนอก polygon)
import { describe, it, expect } from 'vitest';
import {
  distancePointToSegment,
  pointInPolygon,
  nearestNodeIndex,
  nearestSegmentIndex,
  type Pt,
} from './hittest';

describe('distancePointToSegment', () => {
  it('จุดบน segment → 0', () => {
    expect(distancePointToSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
  });
  it('จุดเหนือ segment → ระยะตั้งฉาก', () => {
    expect(distancePointToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3);
  });
  it('โปรเจกชันก่อนจุดเริ่ม → clamp ที่ a', () => {
    expect(distancePointToSegment({ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5);
  });
  it('โปรเจกชันเลยจุดปลาย → clamp ที่ b', () => {
    expect(distancePointToSegment({ x: 15, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5);
  });
  it('segment degenerate (a==b) → ระยะ p→a', () => {
    expect(distancePointToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5);
  });
});

describe('pointInPolygon', () => {
  const square: Pt[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  it('จุดกลาง square → inside', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
  });
  it('จุดไกล square → outside', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(false);
  });
  it('จุดติดลบ → outside', () => {
    expect(pointInPolygon({ x: -1, y: 5 }, square)).toBe(false);
  });
  it('จุด<3 → false', () => {
    expect(pointInPolygon({ x: 0, y: 0 }, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });
  it('L-shape concave: จุดในรอยเว้าต้องเป็น outside', () => {
    // L ที่มุมขวาบนถูกเว้าออก (square 0..10 ลบมุม 5..10 × 5..10)
    const L: Pt[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(pointInPolygon({ x: 7, y: 7 }, L)).toBe(false); // ในรอยเว้า
    expect(pointInPolygon({ x: 2, y: 2 }, L)).toBe(true); // ใน L
  });
});

describe('nearestNodeIndex', () => {
  const pts: Pt[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];
  it('จุดทับ node → คืน index นั้น', () => {
    expect(nearestNodeIndex({ x: 10, y: 0 }, pts, 5)).toBe(1);
  });
  it('จุดใกล้ node ภายในรัศมี → คืน index ใกล้สุด', () => {
    expect(nearestNodeIndex({ x: 1, y: 1 }, pts, 5)).toBe(0);
  });
  it('จุดนอกรัศมีทุก node → คืน -1', () => {
    expect(nearestNodeIndex({ x: 100, y: 100 }, pts, 5)).toBe(-1);
  });
  it('รัศมี 0 + จุดทับพอดี → คืน index นั้น (inclusive)', () => {
    expect(nearestNodeIndex({ x: 10, y: 10 }, pts, 0)).toBe(2);
  });
});

describe('nearestSegmentIndex', () => {
  const pts: Pt[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];
  it('จุดบน segment 0 → คืน 0', () => {
    expect(nearestSegmentIndex({ x: 5, y: 0 }, pts, 1)).toBe(0);
  });
  it('จุดบน segment 1 → คืน 1', () => {
    expect(nearestSegmentIndex({ x: 10, y: 5 }, pts, 1)).toBe(1);
  });
  it('นอก tolerance → -1', () => {
    expect(nearestSegmentIndex({ x: 50, y: 50 }, pts, 4)).toBe(-1);
  });
  it('closed=true เพิ่ม segment สุดท้าย → คืน 2 สำหรับ segment ปิด', () => {
    // segment 2 = pts[2](10,10) → pts[0](0,0) แนวเส้น y=x
    expect(nearestSegmentIndex({ x: 5, y: 5 }, pts, 1, true)).toBe(2);
  });
});
