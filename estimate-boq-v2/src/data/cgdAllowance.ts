/**
 * cgdAllowance — ค่าคงที่ "เกณฑ์การเผื่อ + วัสดุมวลรวมต่อหน่วย" (กรมบัญชีกลาง)
 * แหล่งอ้างอิงหลัก: หลักเกณฑ์การคำนวณราคากลางงานก่อสร้างอาคาร
 *   "เกณฑ์การเผื่อและหาปริมาณวัสดุมวลรวมต่อหน่วยของงานประเภทต่างๆ"
 * เอกสารคู่ (คนอ่าน): docs/cgd-allowance-reference.md
 *
 * หลักการ: ไฟล์นี้ = single source of truth ของค่าเผื่อ/มวลรวม (โค้ดล็อก)
 *   ห้าม hard-code ค่าเหล่านี้ซ้ำที่อื่น — import จากที่นี่เท่านั้น
 * pure data: ไม่ import โค้ดอื่น · ไม่มี logic
 * ค่าเผื่อทั้งหมดเป็น "เปอร์เซ็นต์ที่ต้องบวก" (ตรงกับ convention wastePct เดิม: qty×(1+pct/100))
 */

// ── ข้อ 1 · งานขุดดินฐานราก + ถมคืน — เผื่อ 30% (×1.30) ──
// ★ แทนวิธี +0.50ม.ข้างละ เดิม (rule-14 resolved 7 มิ.ย.2569)
//   ปริมาตรขุดคิดราคากลาง = ปริมาตรขุดสุทธิ × (1 + 30/100)
export const EXCAVATION_ALLOWANCE_PCT = 30;

// ── ข้อ 2 · วัสดุรองพื้น/ปรับระดับ/ถมบริเวณ (เผื่อยุบตัว) — %เผื่อ ──
export const FILL_ALLOWANCE_PCT = {
  sandSubbase: 25, // ถมทรายรองพื้น (บดแรงคน) — ใช้กับทรายรองฐานราก
  soilSubbase: 30, // ถมดินรองพื้น
  lateriteSubbase: 35, // ดินลูกรังรองพื้น
  brickSubbase: 25, // อิฐหักรองพื้น
  areaSand: 40, // ถมบริเวณ-ทราย (บดเครื่องจักร)
  areaSoil: 60, // ถมบริเวณ-ดิน
  areaLaterite: 60, // ถมบริเวณ-ลูกรัง
  areaBrick: 50, // ถมบริเวณ-อิฐหัก
} as const;

// ── ข้อ 8 · คอนกรีตมวลรวม ต่อ 1 ลบ.ม. (รวมเผื่อแล้ว) ──
// cement = กก. · sand/rock = ลบ.ม. · water = ลิตร
export interface ConcreteMix {
  cement: number;
  sand: number;
  rock: number;
  water: number;
}
export const CONCRETE_MIX: Record<string, ConcreteMix> = {
  '1:3:5': { cement: 260, sand: 0.63, rock: 1.03, water: 180 }, // คอนกรีตหยาบ (lean) — รองฐานราก
  '1:2:4': { cement: 342, sand: 0.56, rock: 1.09, water: 180 },
  'ค.1': { cement: 304, sand: 0.43, rock: 0.98, water: 180 }, // มยผ. 180 ksc
  'ค.2': { cement: 336, sand: 0.6, rock: 1.09, water: 180 }, // มยผ. 240 ksc
  'ค.3': { cement: 367, sand: 0.66, rock: 0.92, water: 180 }, // มยผ. 300 ksc
  'ค.4': { cement: 420, sand: 0.5, rock: 0.98, water: 180 }, // มยผ. 350 ksc
};

// ── ข้อ 4-5 · เหล็กเสริม: %เผื่อต่อขนาด + น้ำหนัก กก./ม. ──
export interface RebarSpec {
  wastePct: number; // %เผื่อ (ทาบต่อ/งอ/เศษ)
  weightKgPerM: number; // น้ำหนัก กก./ม.
}
export const REBAR: Record<string, RebarSpec> = {
  // SR-24 เส้นกลมผิวเรียบ
  RB6: { wastePct: 5, weightKgPerM: 0.222 },
  RB9: { wastePct: 7, weightKgPerM: 0.499 },
  RB12: { wastePct: 9, weightKgPerM: 0.888 },
  RB15: { wastePct: 11, weightKgPerM: 1.39 },
  RB19: { wastePct: 13, weightKgPerM: 2.23 },
  RB25: { wastePct: 15, weightKgPerM: 3.85 },
  RB28: { wastePct: 15, weightKgPerM: 4.83 },
  // SD-30/40 เส้นกลมผิวข้ออ้อย
  DB12: { wastePct: 9, weightKgPerM: 0.888 },
  DB16: { wastePct: 11, weightKgPerM: 1.58 },
  DB20: { wastePct: 13, weightKgPerM: 2.47 }, // ★ ยืนยัน 13% (ไฟล์2 พิมพ์ 11 ตกหล่น)
  DB25: { wastePct: 15, weightKgPerM: 3.85 },
  DB28: { wastePct: 15, weightKgPerM: 4.83 },
};

// ── ข้อ 5/6 · ลวดผูกเหล็ก: 30 กก./เหล็ก 1 เมตริกตัน = 0.03 kg/kg ──
export const TIE_WIRE_KG_PER_TON = 30;
export const TIE_WIRE_RATIO = 0.03;

// ── ข้อ 3 · งานแบบหล่อคอนกรีต ──
export const FORMWORK = {
  timberCuFtPerSqm: 1, // ไม้แบบหนา 1": 1 ตร.ม. ≈ 1 ลบ.ฟุต (ข้อ 3.2.1)
  battenRatio: 0.3, // ไม้คร่าวยึด = 30% ของปริมาณไม้แบบ (ข้อ 3.2.2)
  shoreBeamPerM: 1, // ไม้ค้ำยันคาน 1 ต้น/ความยาว 1 ม. (ข้อ 3.2.3.1)
  shoreSlabPerSqm: 1, // ไม้ค้ำยันพื้น 1 ต้น/ตร.ม. (ข้อ 3.2.3.2)
  nailKgPerSqm: 0.25, // ตะปูยึดไม้แบบ 0.25 กก./ตร.ม. (ข้อ 3.2.4)
} as const;

// ── ข้อ 3.3 · ลดไม้แบบใช้ซ้ำ (เฉพาะวัสดุไม้ ไม่ลดค่าแรง) ──
// key = จำนวนชั้นอาคาร (4 = 4 ชั้นขึ้นไป) · value = สัดส่วนวัสดุที่ใช้จริง
export const FORMWORK_REUSE_FRACTION: Record<number, number> = {
  1: 0.8,
  2: 0.7,
  3: 0.6,
  4: 0.5,
};

// ── ข้อ 6 · ตะปูงานไม้อื่น (กก./ตร.ม.) ──
export const NAIL_KG_PER_SQM = {
  beamJoistFloor: 0.2, // วางคาน/ตง/ปูพื้นไม้
  roofShed: 0.2, // หลังคาเพิงแหงน
  roofGable: 0.2, // จั่ว
  roofHip: 0.25, // ปั้นหยา
  roofThai: 0.3, // ทรงไทย
} as const;
