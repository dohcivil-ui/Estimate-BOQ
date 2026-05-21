import { describe, it, expect } from 'vitest';
import { pageToScreen, screenToPage, type ViewTransform } from './coords';

const t: ViewTransform = { zoom: 2, panX: 100, panY: 50 };

describe('coords: transform', () => {
  it('page→screen: (10,20)@zoom2,pan(100,50) → (120,90)', () => {
    const s = pageToScreen({ x: 10, y: 20 }, t);
    expect(s.x).toBeCloseTo(120); expect(s.y).toBeCloseTo(90);
  });
  it('round-trip: page→screen→page ได้จุดเดิม', () => {
    const p = { x: 37.5, y: 128.25 };
    const back = screenToPage(pageToScreen(p, t), t);
    expect(back.x).toBeCloseTo(p.x); expect(back.y).toBeCloseTo(p.y);
  });
  it('zoom=1,pan=0 → identity', () => {
    const id: ViewTransform = { zoom: 1, panX: 0, panY: 0 };
    const s = pageToScreen({ x: 5, y: 9 }, id);
    expect(s.x).toBeCloseTo(5); expect(s.y).toBeCloseTo(9);
  });
});
