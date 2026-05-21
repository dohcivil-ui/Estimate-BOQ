import { describe, it, expect } from 'vitest';
import { distancePx, toMeters, calibrateScale } from './scale';

describe('scale: distance & unit', () => {
  it('3-4-5 ×40 → 200px', () => {
    expect(distancePx({ x: 0, y: 0 }, { x: 120, y: 160 })).toBeCloseTo(200);
  });
  it('toMeters m/mm', () => {
    expect(toMeters(5, 'm')).toBeCloseTo(5);
    expect(toMeters(5000, 'mm')).toBeCloseTo(5);
  });
});

describe('scale: calibrate (200px = 5.00m)', () => {
  const s = () => calibrateScale({ x: 0, y: 0 }, { x: 200, y: 0 }, 5, 'm');
  it('unitPerPixel = 0.025 m/px', () => { expect(s().unitPerPixel).toBeCloseTo(0.025); });
  it('pixelPerUnit = 40 px/m', () => { expect(s().pixelPerUnit).toBeCloseTo(40); });
  it('หน่วย mm ให้ผลเท่ากัน (200px = 5000mm)', () => {
    const s2 = calibrateScale({ x: 0, y: 0 }, { x: 200, y: 0 }, 5000, 'mm');
    expect(s2.unitPerPixel).toBeCloseTo(0.025);
  });
});

// guard tests — กัน unitPerPixel/pixelPerUnit = Infinity/NaN ที่จะ poison BOQ ทุกบรรทัด
describe('scale: invalid inputs guard', () => {
  it('p1===p2 (pixelDistance=0) → throw', () => {
    expect(() => calibrateScale({ x: 5, y: 5 }, { x: 5, y: 5 }, 5, 'm')).toThrow();
  });
  it('realDistance=0 → throw', () => {
    expect(() => calibrateScale({ x: 0, y: 0 }, { x: 200, y: 0 }, 0, 'm')).toThrow();
  });
  it('normal calibration → unitPerPixel/pixelPerUnit finite', () => {
    const s = calibrateScale({ x: 0, y: 0 }, { x: 200, y: 0 }, 5, 'm');
    expect(Number.isFinite(s.unitPerPixel)).toBe(true);
    expect(Number.isFinite(s.pixelPerUnit)).toBe(true);
  });
});
