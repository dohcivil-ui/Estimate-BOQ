/**
 * Test legacy label migration ตอน deserialize BOQ rows
 * - คำผิดเดิม 'ไม้คร่า/...' (ไม่มี เ) → คำถูก 'ไม้เคร่า/...'
 * - prefix-match '/' เท่านั้น (กัน 'ไม้คร่าว' ที่เป็นคำถูกของ furring)
 */
import { describe, it, expect } from 'vitest';
import { normalizeLegacyItemName } from './projectSync';

// helper: สร้างสตริงไทยระดับ codepoint เพื่อความชัวร์ (ไม่พึ่ง editor encoding)
const KHRA = String.fromCodePoint(
  0x0e44, // ไ
  0x0e21, // ม
  0x0e49, // ้
  0x0e04, // ค
  0x0e23, // ร
  0x0e48, // ่
  0x0e32, // า
); // 'ไม้คร่า' (legacy — ไม่มี เ)

const KHREA = String.fromCodePoint(
  0x0e44, // ไ
  0x0e21, // ม
  0x0e49, // ้
  0x0e40, // เ
  0x0e04, // ค
  0x0e23, // ร
  0x0e48, // ่
  0x0e32, // า
); // 'ไม้เคร่า' (canonical)

const KHRAW = KHRA + String.fromCodePoint(0x0e27); // 'ไม้คร่าว' (furring — คำถูก)

describe('normalizeLegacyItemName', () => {
  it("ไม้คร่า/... → ไม้เคร่า/... (legacy prefix migration)", () => {
    const input = 'ไม้คร่า/ตงยึดไม้แบบ';
    const expected = 'ไม้เคร่า/ตงยึดไม้แบบ';
    expect(normalizeLegacyItemName(input)).toBe(expected);
  });

  it("'ไม้คร่าว 1x2\"' คงเดิม (ห้ามแตะ furring)", () => {
    const input = `${KHRAW} 1x2"`;
    expect(normalizeLegacyItemName(input)).toBe(input);
  });

  it("idempotent: 'ไม้เคร่า/...' คงเดิมเมื่อรันซ้ำ", () => {
    const input = 'ไม้เคร่า/ตงยึดไม้แบบ';
    expect(normalizeLegacyItemName(input)).toBe(input);
    expect(normalizeLegacyItemName(normalizeLegacyItemName(input))).toBe(input);
  });

  it('codepoint-level: migration ผลิต sequence ของ ไม้เคร่า ตรง spec', () => {
    const input = `${KHRA}/ตง`;
    const out = normalizeLegacyItemName(input);
    // 8 codepoints แรกของ output = KHREA + '/'
    const prefix = Array.from(out).slice(0, 9);
    const expected = [
      ...Array.from(KHREA),
      '/',
    ];
    expect(prefix).toEqual(expected);
  });

  it('non-match: คำอื่น ๆ คงเดิม', () => {
    expect(normalizeLegacyItemName('คอนกรีต C240')).toBe('คอนกรีต C240');
    expect(normalizeLegacyItemName('')).toBe('');
  });
});
