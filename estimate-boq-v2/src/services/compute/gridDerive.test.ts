import { describe, it, expect } from 'vitest';
import { deriveAxesFromLines } from './gridDerive';
import type { GridLine } from '@/types/tool';

// helper สร้างเส้น (พิมพ์ชนิดให้ครบ กัน lint/strict)
const line = (ax: number, ay: number, bx: number, by: number): GridLine =>
  ({ a: { x: ax, y: ay }, b: { x: bx, y: by } });

describe('deriveAxesFromLines', () => {
  it('baseline 6 ตั้ง × 2 นอน → 1..6 × A,B (จุดตัด 12)', () => {
    const lines = [
      line(300,50,300,350), line(100,50,100,350), line(600,50,600,350), // ตั้ง สลับลำดับ
      line(200,50,200,350), line(500,50,500,350), line(400,50,400,350),
      line(100,350,600,350), line(100,50,600,50),                       // นอน 2 เส้น
    ];
    const { longAxis, shortAxis } = deriveAxesFromLines(lines);
    expect(longAxis).toEqual(['1','2','3','4','5','6']); // เรียงซ้าย→ขวา
    expect(shortAxis).toEqual(['A','B']);                // บน=A ล่าง=B
    expect(longAxis.length * shortAxis.length).toBe(12); // จุดตัด baseline
  });
  it('ว่าง → แกนว่างทั้งคู่', () => {
    expect(deriveAxesFromLines([])).toEqual({ longAxis: [], shortAxis: [] });
  });
  it('จำแนกด้วยแกนเด่น (เกือบตั้ง=ตั้ง, เกือบนอน=นอน)', () => {
    const { longAxis, shortAxis } = deriveAxesFromLines([line(0,0,5,200), line(0,0,200,5)]);
    expect(longAxis.length).toBe(1);
    expect(shortAxis.length).toBe(1);
  });
  it('นับ N×M ถูกผ่าน length (2 ตั้ง 1 นอน → 2)', () => {
    const { longAxis, shortAxis } = deriveAxesFromLines([line(0,0,0,100), line(50,0,50,100), line(0,0,100,0)]);
    expect(longAxis.length * shortAxis.length).toBe(2);
  });
  it('กรองเส้น guide ออก ไม่นับเป็นแกน (inc4a)', () => {
    const lines = [
      line(0, 0, 0, 100),     // ตั้ง (แกน)
      line(50, 0, 50, 100),   // ตั้ง (แกน)
      line(0, 0, 100, 0),     // นอน (แกน)
      { ...line(25, 0, 25, 100), kind: 'guide' as const }, // เส้นช่วย — ต้องถูกกรองทิ้ง
    ];
    const { longAxis, shortAxis } = deriveAxesFromLines(lines);
    expect(longAxis).toEqual(['1', '2']);  // เส้นตั้งจริง 2 (guide ไม่ถูกนับ)
    expect(shortAxis).toEqual(['A']);      // เส้นนอน 1
  });
});
