// src/services/compute/parseBeamBars.test.ts
// เทสต์จริงตัวแรกของ v2 — P3-2 beam main steel undercount
import { test, expect } from 'vitest';
import { parseBeamBars } from './parseBeamBars';

test('กลุ่มเดียว — ทำงานถูกเหมือนเดิม', () => {
  expect(parseBeamBars('2-DB16')).toEqual([{ size: 'DB16', count: 2 }]);
});

test('continuation "+1-DB12" ในโทเค็นเดียว', () => {
  expect(parseBeamBars('2-DB16+1-DB12 เสริมพิเศษ')).toEqual([
    { size: 'DB16', count: 2 },
    { size: 'DB12', count: 1 },
  ]);
});

test('บน/ล่าง หลายกลุ่ม — เคสที่เคย undercount ~ครึ่ง', () => {
  expect(parseBeamBars('บน 2-DB16 ล่าง 4-DB20')).toEqual([
    { size: 'DB16', count: 2 },
    { size: 'DB20', count: 4 },
  ]);
});

test('ground-truth จากตำรา B1 — 4 กลุ่ม', () => {
  // "2-DB16, 2-DB12 เสริม, 2-DB16+1-DB12 เสริมพิเศษ"
  expect(parseBeamBars('2-DB16, 2-DB12 เสริม, 2-DB16+1-DB12 เสริมพิเศษ')).toEqual([
    { size: 'DB16', count: 2 },
    { size: 'DB12', count: 2 },
    { size: 'DB16', count: 2 },
    { size: 'DB12', count: 1 },
  ]);
});

test('ว่าง/undefined → []', () => {
  expect(parseBeamBars('')).toEqual([]);
  expect(parseBeamBars(undefined)).toEqual([]);
});

test('edge: stirrup token ในสตริงไม่ถูกจับ (RB ไม่มี count นำหน้า)', () => {
  // ถ้าเทสต์นี้ fail = regex ไวเกินกับ data ปนเปื้อน → ต้องคุยเรื่องจำกัดเป็น DB-only
  expect(parseBeamBars('2-DB16 ป-RB6@0.20')).toEqual([{ size: 'DB16', count: 2 }]);
});
