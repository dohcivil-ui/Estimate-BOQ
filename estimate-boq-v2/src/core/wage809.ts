/**
 * ราคาค่าแรงตามบัญชี ว.809 (14 พ.ย. 2568) กรมบัญชีกลาง — preset list
 *
 * **หมายเหตุ:** ค่าทั้งหมดเป็น "ค่าแรง" ต่อหน่วย ไม่รวมค่าวัสดุ
 * วัสดุผู้ใช้ต้องกรอกเอง (ราคารายจังหวัด สนค./โควต)
 *
 * อ้างอิงเอกสาร: บัญชีค่ากลางแรงงานก่อสร้าง ว.809 ม.14 พ.ย. 68
 */

export type LaborUnit = 'ลบ.ม.' | 'ตร.ม.' | 'ตัน' | 'เมตร' | 'จุด' | 'ชุด';

export interface LaborPreset {
  /** unique id (ใช้ใน reference เท่านั้น) */
  id: string;
  /** หมวด: งานเตรียมการ/งานโครงสร้าง/งานสถาปัตย์/... */
  category: string;
  /** ชื่อรายการ */
  name: string;
  unit: LaborUnit;
  /** ค่าแรง (บ./หน่วย) */
  rate: number;
  /** ค่า default เผื่อเสีย (%) — ใช้กับ rebar เป็น 7% concrete 3% */
  defaultWastePct?: number;
  /** ต้องใช้คู่กับความหนา? (เช่น slab/wall) */
  needsThickness?: boolean;
}

/**
 * บัญชีค่าแรง ว.809 — verify ตรง PDF กค 0433.2/ว 809 ลว. 14 พ.ย. 2568 หน้า 3–4 (ตรวจ 11 มิ.ย. 2569)
 * แก้/เพิ่มได้ที่นี่ที่เดียว — ห้าม hardcode ใน UI
 */
export const LABOR_PRESETS_W809: LaborPreset[] = [
  // ─── งานดิน ───────────────────────────────────────────────────────────
  {
    id: 'excavation-footing',
    category: 'งานดิน',
    name: 'ขุดดินฐานราก',
    unit: 'ลบ.ม.',
    rate: 181,
  },

  // ─── งานโครงสร้าง — คอนกรีต ───────────────────────────────────────────
  {
    id: 'concrete-rough',
    category: 'งานโครงสร้าง',
    name: 'คอนกรีตหยาบ (lean concrete)',
    unit: 'ลบ.ม.',
    rate: 427,
    defaultWastePct: 3,
  },
  {
    id: 'concrete-pour-walkway',
    category: 'งานโครงสร้าง',
    name: 'เทคอนกรีตผสมเสร็จ — ทางเท้า/ทางระบายน้ำ/ถนนภายใน',
    unit: 'ลบ.ม.',
    rate: 329, // ว.809 ข้อ 1.7 หน้า 3
    defaultWastePct: 3,
  },
  {
    id: 'concrete-pour-1story',
    category: 'งานโครงสร้าง',
    name: 'เทคอนกรีตผสมเสร็จ — อาคารชั้นเดียว',
    unit: 'ลบ.ม.',
    rate: 421, // ว.809 ข้อ 1.7 หน้า 3 (default งานอาคาร)
    defaultWastePct: 3,
  },
  {
    id: 'concrete-pour-multistory',
    category: 'งานโครงสร้าง',
    name: 'เทคอนกรีตผสมเสร็จ — อาคารหลายชั้น',
    unit: 'ลบ.ม.',
    rate: 522, // ว.809 ข้อ 1.7 หน้า 3
    defaultWastePct: 3,
  },

  // ─── งานโครงสร้าง — เหล็กเสริม (ตาม diameter) ─────────────────────────
  {
    id: 'rebar-small',
    category: 'งานโครงสร้าง',
    name: 'เหล็กเสริม Ø < 10 มม. (เช่น RB6/RB9)',
    unit: 'ตัน',
    rate: 4900, // ว.809 ข้อ 1.10.1 ผิวเรียบ Ø<10 มม. หน้า 4 ✓
    defaultWastePct: 7,
  },
  {
    id: 'rebar-medium',
    category: 'งานโครงสร้าง',
    name: 'เหล็กเสริม Ø 10–16 มม. (DB10/DB12/DB16)',
    unit: 'ตัน',
    rate: 3900, // ว.809 ข้อ 1.10.2 ผิวเรียบ/ข้ออ้อย 10–16 มม. หน้า 4 ✓
    defaultWastePct: 7,
  },
  {
    id: 'rebar-large',
    category: 'งานโครงสร้าง',
    name: 'เหล็กเสริม Ø > 16 มม. (DB20/DB25)',
    unit: 'ตัน',
    rate: 3500, // ว.809 ข้อ 1.10.3 ผิวเรียบ/ข้ออ้อย >16 มม. หน้า 4 ✓
    defaultWastePct: 7,
  },
  {
    id: 'rebar-mesh-laying',
    category: 'งานโครงสร้าง',
    name: 'วางตะแกรงเหล็กสำเร็จรูป (wire mesh)',
    unit: 'ตร.ม.',
    rate: 6, // ว.809 ข้อ 1.10.4 หน้า 4
  },

  // ─── งานโครงสร้าง — ไม้แบบ ────────────────────────────────────────────
  {
    id: 'formwork',
    category: 'งานโครงสร้าง',
    name: 'ไม้แบบทั่วไป',
    unit: 'ตร.ม.',
    rate: 163, // ว.809 ข้อ 1.8.1 แบบหล่อทั่วไป <5,000 ตร.ม. หน้า 3 ✓ (163)
    defaultWastePct: 5,
  },

  // ─── งานสถาปัตย์ — ผนัง ────────────────────────────────────────────────
  {
    id: 'wall-aac-7-5',
    category: 'งานสถาปัตย์',
    name: 'ก่ออิฐมวลเบาหนา 7.5 ซม.',
    unit: 'ตร.ม.',
    rate: 73,
  },
  {
    id: 'plaster-interior',
    category: 'งานสถาปัตย์',
    name: 'ฉาบปูนภายใน',
    unit: 'ตร.ม.',
    rate: 96,
  },
  {
    id: 'plaster-exterior',
    category: 'งานสถาปัตย์',
    name: 'ฉาบปูนภายนอก',
    unit: 'ตร.ม.',
    rate: 109,
  },

  // ─── งานสถาปัตย์ — สี/พื้น ────────────────────────────────────────────
  {
    id: 'paint-interior',
    category: 'งานสถาปัตย์',
    name: 'ทาสีน้ำภายใน',
    unit: 'ตร.ม.',
    rate: 31,
  },
  {
    id: 'paint-exterior',
    category: 'งานสถาปัตย์',
    name: 'ทาสีน้ำภายนอก',
    unit: 'ตร.ม.',
    rate: 35,
  },
  {
    id: 'tile-floor-24x24',
    category: 'งานสถาปัตย์',
    name: 'กระเบื้องพื้น 24×24 ซม.',
    unit: 'ตร.ม.',
    rate: 178,
  },

  // ─── ส่วนประกอบสถาปัตย์ ────────────────────────────────────────────────
  {
    id: 'lintel-stud',
    category: 'งานสถาปัตย์',
    name: 'เสาเอ็น / ทับหลัง',
    unit: 'เมตร',
    rate: 51,
  },
];

/**
 * น้ำหนักเหล็กเสริม (กก./เมตร) = 0.006165 × d²
 * d = diameter หน่วย มม.
 *
 * pre-computed สำหรับขนาดมาตรฐานที่ใช้ในงานไทย
 */
export const REBAR_WEIGHT_KG_PER_M: Record<string, number> = {
  RB6: 0.222,
  RB9: 0.499,
  DB10: 0.617,
  DB12: 0.888,
  DB16: 1.578,
  DB20: 2.466,
  DB25: 3.853,
};

/** คำนวณน้ำหนักเหล็ก (kg/m) จาก diameter (mm) — สูตร 0.006165 × d² */
export function rebarWeightPerMeter(diameterMm: number): number {
  return 0.006165 * diameterMm * diameterMm;
}

/** จับคู่ size code → labor preset ที่เหมาะ */
export function laborPresetForRebar(sizeCode: string): LaborPreset | null {
  const m = sizeCode.match(/(?:RB|DB)(\d+)/i);
  if (!m) return null;
  const d = parseInt(m[1]!, 10);
  if (d < 10) return LABOR_PRESETS_W809.find((p) => p.id === 'rebar-small') ?? null;
  if (d <= 16) return LABOR_PRESETS_W809.find((p) => p.id === 'rebar-medium') ?? null;
  return LABOR_PRESETS_W809.find((p) => p.id === 'rebar-large') ?? null;
}
