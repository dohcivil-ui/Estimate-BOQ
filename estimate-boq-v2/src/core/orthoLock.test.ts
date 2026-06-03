import { describe, it, expect } from 'vitest';
import { applyHVLock } from './orthoLock';

describe('applyHVLock', () => {
  it('เกือบแนวนอน → ล็อก H (คง y จุดเริ่ม)', () => {
    // x เด่น → ยืด x ตามเคอร์เซอร์, y กลับไปเท่าจุดเริ่ม
    expect(applyHVLock({ x: 0, y: 0 }, { x: 100, y: 10 })).toEqual({ x: 100, y: 0 });
  });
  it('เกือบแนวตั้ง → ล็อก V (คง x จุดเริ่ม)', () => {
    // y เด่น → ยืด y ตามเคอร์เซอร์, x กลับไปเท่าจุดเริ่ม
    expect(applyHVLock({ x: 0, y: 0 }, { x: 10, y: 100 })).toEqual({ x: 0, y: 100 });
  });
  it('เฉียง 45° พอดี |dx|==|dy| → tie เลือกแนวนอน', () => {
    expect(applyHVLock({ x: 0, y: 0 }, { x: 50, y: 50 })).toEqual({ x: 50, y: 0 });
  });
  it('ทิศลบแนวนอน → ล็อก H (รักษาเครื่องหมาย x)', () => {
    expect(applyHVLock({ x: 0, y: 0 }, { x: -80, y: -5 })).toEqual({ x: -80, y: 0 });
  });
});
