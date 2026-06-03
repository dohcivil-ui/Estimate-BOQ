import { describe, it, expect } from 'vitest';
import { distancePointToSegment } from './geometry';

describe('distancePointToSegment', () => {
  it('จุดอยู่บนเส้น → ระยะ 0', () => {
    expect(distancePointToSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
  });
  it('จุดตั้งฉากกลางเส้น → ระยะตั้งฉาก', () => {
    expect(distancePointToSegment({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(4);
  });
  it('จุดเลยปลายเส้น → clamp ที่ปลาย', () => {
    expect(distancePointToSegment({ x: 13, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
  });
  it('เส้นยาว 0 (a===b) → ระยะถึงจุดเดียว', () => {
    expect(distancePointToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});
