/**
 * cgdSectionMap.ts — จัดหมวด CGD (code 1–12) ให้ Por4Row
 * ─────────────────────────────────────────────────────────────────────────
 * แหล่งความจริงเดียวสำหรับ "รายการ BOQ → หมวด ปร.4 (ฟอร์ม CGD)"
 * ใช้ร่วมทั้ง: (1) จอแสดงผล (หัวข้อหมวด) (2) export (buildingItems[code])
 * → จอกับฟอร์มราชการตรงกันเสมอ
 *
 * code อ้าง BUILDING.sections ใน govExcelMap.ts (ชื่อหมวดอยู่ที่นั่น — ที่นี่ใช้แค่เลข code)
 *   1 รื้อถอน · 2 โครงสร้างวิศวกรรม · 3 สถาปัตย · 4 สุขาภิบาล · 5 ไฟฟ้า
 *   6 ปรับอากาศ · 7 ลิฟท์ · 8 เครื่องกล · 9 ครุภัณฑ์จัดจ้าง · 10 ตกแต่งภายใน
 *   11 ภูมิทัศน์ · 12 ผังบริเวณ
 *
 * หลักการจัด: materialKey เป็นหลัก (ละเอียด/แม่น) → category fallback (หยาบ) → null=UNMAPPED (ให้ caller flag)
 * sub (1.x/2.x) = label หัวข้อย่อยบนแถว exporter (v1 ไม่มี subtotal ย่อย — เป็น label เพื่อแสดงผล)
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface CgdTarget {
  /** หมวด CGD 1–12 (ตรง BUILDING.sections[].code) */
  code: number;
  /** หัวข้อย่อยสำหรับแสดง (label only ใน v1) */
  sub: string;
}

/**
 * materialKey → CGD (prefix/exact match, เรียงจาก specific → generic)
 * ชุดปัจจุบัน = งานโครงสร้าง/ฐานราก ทั้งหมด → code 2
 * แถว reserved (floor:*) = เผื่ออนาคต ตามที่วิศวกรเคาะเรื่อง "งานพื้น"
 */
const MATERIAL_KEY_RULES: Array<{ test: (k: string) => boolean; target: CgdTarget }> = [
  // ── งานดิน หิน ทราย และฐานราก (1.2) ──
  { test: (k) => k.startsWith('earth:'),         target: { code: 2, sub: '1.2 งานดิน หิน ทราย และฐานราก' } },
  { test: (k) => k.startsWith('sand:'),          target: { code: 2, sub: '1.2 งานดิน หิน ทราย และฐานราก' } },
  { test: (k) => k === 'concrete:lean',          target: { code: 2, sub: '1.2 งานดิน หิน ทราย และฐานราก' } }, // ❓ 1.2 หรือ 1.5
  // ── งานแบบหล่อคอนกรีต (1.4) ──
  { test: (k) => k.startsWith('formwork:'),      target: { code: 2, sub: '1.4 งานแบบหล่อคอนกรีต' } },
  { test: (k) => k === 'consumable:nails',       target: { code: 2, sub: '1.4 งานแบบหล่อคอนกรีต' } },
  // ── งานคอนกรีตโครงสร้าง (1.5) ──
  { test: (k) => k.startsWith('concrete:'),      target: { code: 2, sub: '1.5 งานคอนกรีตโครงสร้าง' } },
  // ── งานเหล็กเสริมคอนกรีต (1.6) ──
  { test: (k) => k === 'rebar:mesh',             target: { code: 2, sub: '1.6 งานเหล็กเสริมคอนกรีต' } }, // ❓ 1.6 หรือ 1.7
  { test: (k) => k.startsWith('rebar:'),         target: { code: 2, sub: '1.6 งานเหล็กเสริมคอนกรีต' } },
  { test: (k) => k === 'consumable:tiewire',     target: { code: 2, sub: '1.6 งานเหล็กเสริมคอนกรีต' } },
  // ── reserved (ยังไม่มี materialKey จริง — ตามที่เคาะเรื่องงานพื้น) ──
  { test: (k) => k === 'floor:precast',          target: { code: 2, sub: '1.7 งานพื้นสำเร็จรูป' } },        // พื้นสำเร็จรูป (เมื่อมี)
  { test: (k) => k.startsWith('floor:finish'),   target: { code: 3, sub: '2.3 งานพื้น (ผิวพื้น)' } },       // ปูกระเบื้อง/ขัดมัน/ขัดหยาบ — ทุกอาคาร
];

/**
 * category fallback (ใช้เมื่อ materialKey = undefined/UNMAPPED)
 * "งานพื้น" = กำกวม → default ผิวพื้น (code 3, ทุกอาคารมี) ตามที่วิศวกรเคาะ
 *   ส่วนพื้นสำเร็จรูปให้แยกด้วย materialKey floor:precast (→ code 2/1.7)
 */
const CATEGORY_FALLBACK: Record<string, CgdTarget> = {
  งานโครงสร้าง: { code: 2, sub: '1.2–1.8 งานโครงสร้างวิศวกรรม' },
  ฐานราก: { code: 2, sub: '1.2 งานดิน หิน ทราย และฐานราก' },
  งานฐานราก: { code: 2, sub: '1.2 งานดิน หิน ทราย และฐานราก' },
  งานดิน: { code: 2, sub: '1.2 งานดิน หิน ทราย และฐานราก' },
  งานคาน: { code: 2, sub: '1.5 งานคอนกรีตโครงสร้าง' },
  'งานสถาปัตย์': { code: 3, sub: 'งานสถาปัตยกรรม' },
  งานพื้น: { code: 3, sub: '2.3 งานพื้น (ผิวพื้น)' },
};

/**
 * จัดหมวด CGD ให้ 1 รายการ — materialKey ก่อน, category fallback
 * คืน null = UNMAPPED → caller ต้อง flag (ไม่เงียบ ไม่เดาหมวด)
 */
export function cgdTargetFor(
  materialKey: string | undefined,
  category: string,
): CgdTarget | null {
  if (materialKey) {
    const hit = MATERIAL_KEY_RULES.find((r) => r.test(materialKey));
    if (hit) return hit.target;
  }
  return CATEGORY_FALLBACK[category] ?? null;
}
