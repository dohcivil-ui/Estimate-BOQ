/**
 * consumables.ts — วัสดุสิ้นเปลืองที่ผูกกับปริมาณงานหลัก (deterministic)
 * --------------------------------------------------------------------------
 * core compute (footing/beam/slab) คิดเฉพาะปริมาณหลัก (คอนกรีต/เหล็ก/ไม้แบบ/ดิน)
 * โมดูลนี้เติม "ของพ่วง" ที่อิงปริมาณหลัก:
 *   - ลวดผูกเหล็ก  ∝ น้ำหนักเหล็ก
 *   - ตะปู         ∝ พื้นที่ไม้แบบ
 *   - ไม้เคร่า/ตงยึดแบบ (waler) ∝ พื้นที่ไม้แบบ
 *
 * อัตราส่วนทั้งหมดอยู่ใน CONSUMABLE_RATIOS ที่เดียว (กฎ centralized — แก้ที่เดียว)
 * pure module: ไม่มี dependency กับ store/supabase/react
 */

/** อัตราส่วนวัสดุสิ้นเปลือง — config เดียว แก้ที่เดียว (ค่าโดยประมาณ — estimated) */
export interface ConsumableRatios {
  // ลวดผูก 3% (30 กก./ตัน) — ราคากลาง+เผื่อราชการ; ดู docs/cgd-constants.md §A1; ยืนยันเลขหน้า กบก. ภายหลัง
  // AI prompt mirror ค่านี้ที่ aiPrompts.ts:94,654 — ต้อง sync ด้วยมือ (SoT ของเลขสุดท้าย = ค่าใน CONSUMABLE_RATIOS นี้)
  tieWirePct: number;
  // ตะปู 0.25 กก./ตร.ม. — กบก. (ตำรา น.15); ดู docs/cgd-constants.md A2
  nailsPerM2: number;
  /** ไม้เคร่า/ตงยึดแบบ = พื้นที่ไม้แบบ × walerFactor (ม./ตร.ม.) — ตั้งค่าได้ */
  walerFactor: number;
  /**
   * ปริมาตรไม้เคร่าต่อความยาว (ลบ.ฟ./ม.) — แปลง ความยาว → ปริมาตร ตามหน้าตัด
   * default 0.10253 = หน้าตัด 1.5"×3" (= 4.5 ตร.นิ้ว × 39.37 นิ้ว/ม. ÷ 1728 ลบ.นิ้ว/ลบ.ฟ.)
   * สพฐ. คิดไม้เป็น ลบ.ฟ. — เปลี่ยนหน้าตัดที่นี่ที่เดียว
   */
  walerSectionFt3PerM: number;
}

export const CONSUMABLE_RATIOS: ConsumableRatios = {
  tieWirePct: 0.03,
  nailsPerM2: 0.25,
  walerFactor: 0.5,
  walerSectionFt3PerM: 0.10253, // 1.5"×3"
};

/** ปริมาณหลักที่ใช้ derive ของสิ้นเปลือง */
export interface ConsumableTotals {
  rebar_kg: number;
  formwork_m2: number;
}

export interface ConsumableQty {
  tieWire_kg: number; // ลวดผูกเหล็ก (กก.)
  nails_kg: number; // ตะปู (กก.)
  waler_ft3: number; // ไม้เคร่า/ตงยึดแบบ (ลบ.ฟ.)
}

const round1 = (x: number): number => +x.toFixed(1);
const round2 = (x: number): number => +x.toFixed(2);

/**
 * คำนวณวัสดุสิ้นเปลืองจากปริมาณหลัก
 * @param totals  ปริมาณเหล็ก/ไม้แบบรวม
 * @param ratios  อัตราส่วน (default = CONSUMABLE_RATIOS)
 */
export function computeConsumables(
  totals: ConsumableTotals,
  ratios: ConsumableRatios = CONSUMABLE_RATIOS,
): ConsumableQty {
  return {
    tieWire_kg: round1(totals.rebar_kg * ratios.tieWirePct),
    nails_kg: round1(totals.formwork_m2 * ratios.nailsPerM2),
    waler_ft3: round2(totals.formwork_m2 * ratios.walerFactor * ratios.walerSectionFt3PerM),
  };
}
