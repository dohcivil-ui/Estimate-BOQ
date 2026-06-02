import { test, expect } from 'vitest';
import { computeConsumables } from './consumables';

test('ตะปู = พื้นที่ไม้แบบ × 0.25', () => {
  expect(computeConsumables({ rebar_kg: 0, formwork_m2: 100 }).nails_kg).toBe(25);
});

test('ลวดผูก = น้ำหนักเหล็ก × 0.03', () => {
  expect(computeConsumables({ rebar_kg: 100, formwork_m2: 0 }).tieWire_kg).toBe(3);
});
