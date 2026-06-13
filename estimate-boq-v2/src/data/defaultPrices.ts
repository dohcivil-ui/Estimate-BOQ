/**
 * defaultPrices — ราคา baseline เริ่มต้น ป้อนเข้า buildBOQ ตอน compute
 * ───────────────────────────────────────────────────────────────────────
 *  - วัสดุ: ราคากลางอ้างอิง สพฐ. (docs/knowledge/pr4-example-structural-boq.csv)
 *  - ค่าแรง: ว.809 (14 พ.ย. 2568) — single source จาก LABOR_PRESETS_W809 (ไม่ hardcode ซ้ำ)
 *  - ราคาดิบก่อน Factor F (Factor F คิดครั้งเดียวที่ยอดรวม — ห้าม bake ที่นี่)
 *
 * ลำดับชั้นราคา (precedence):
 *   1. baseline นี้ (out-of-box ทุกที่)
 *   2. ราคาจังหวัดจริง (material_prices / TPSO CmiPrice) → override ผ่านปุ่ม 🔄 (review)
 *   3. ผู้ใช้แก้เอง (ล็อก ไม่ถูกทับ)
 *
 * หมายเหตุ:
 *   - ถมกลับ (backfill) ไม่มีใน ว.809 → ใช้ค่าอ้างอิง สพฐ. (= ขุดดิน proxy) ปรับได้
 *   - rebar material ใช้ค่าเดียว ~9.90 (จริงต่างตามขนาดเล็กน้อย 9.57–11.06) → province override ปรับ
 *   - concrete labor = อาคารชั้นเดียว (421) · อาคารหลายชั้น = 522 (ผูกกับ project.floors ภายหลัง)
 */
import type { PriceKey, UnitPrice } from '@/services/compute/footingCompute';
import type { MaterialPriceLike } from '@/services/priceResolver';
import { LABOR_PRESETS_W809 } from '@/core/wage809';

/** ดึง rate ว.809 จาก preset id (single source) */
const w809 = (id: string): number =>
  LABOR_PRESETS_W809.find((p) => p.id === id)?.rate ?? 0;

export const DEFAULT_PRICES: Partial<Record<PriceKey, UnitPrice>> = {
  // material = สพฐ. (CSV) · labor = ว.809
  concrete_m3: { material: 2050, labor: w809('concrete-pour-1story') }, // 421
  lean_m3: { material: 1820, labor: w809('concrete-rough') }, // 427
  sand_m3: { material: 250, labor: 0 }, // buildBOQ ไม่สร้างแถว labor ทราย
  excavation_m3: { material: 0, labor: w809('excavation-footing') }, // 181
  backfill_m3: { material: 0, labor: 67 }, // สพฐ. ref (ว.809 ไม่มี preset ถมกลับ) — ปรับได้
  formwork_m2: { material: 315, labor: w809('formwork') }, // 163
  rebar_kg: { material: 9.9, labor: w809('rebar-medium') / 1000 }, // 3.9 บ./กก. (3900/ตัน)
};

/**
 * MATERIAL_BASELINE — ราคาวัสดุ baseline แบบ name-based (consumable ที่ core ไม่มี PriceKey)
 *  - ที่มา: ราคากลางอ้างอิง สพฐ. (pr4 CSV)
 *  - merge ใน syncBoqPrices: ราคาจังหวัด (material_prices/TPSO) ชนะ baseline นี้
 *  - resolver จับคู่ด้วย name+unit (itemNameMatch) → item ต้องเป็น prefix ของชื่อ row BOQ
 *  - ไม้เคร่า: หน่วย ลบ.ฟ. (C6 เปลี่ยน buildBOQ ม.→ลบ.ฟ. แล้ว) — สพฐ. 285 บ./ลบ.ฟ.
 */
export const MATERIAL_BASELINE: MaterialPriceLike[] = [
  { item: 'ลวดผูกเหล็ก', unit: 'กก.', price: 15 },
  { item: 'ตะปู', unit: 'กก.', price: 15 },
  { item: 'ไม้เคร่า/ตงยึดไม้แบบ', unit: 'ลบ.ฟ.', price: 285 },
];
