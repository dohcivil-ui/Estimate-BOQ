/**
 * footingCompute.ts — แกนคำนวณ ฐานราก → BOQ (deterministic)
 * --------------------------------------------------------------
 * ที่มาสูตร: HANDOFF ข้อ 7 + Custom Instructions กฎ 14/3/4 (ของผู้ใช้เอง)
 * หลักการ: ตัวเลข BOQ ต้องมาจากโค้ดนี้ ไม่ใช่จาก AI → audit/reproduce ได้
 *
 * โมดูลนี้ "บริสุทธิ์" (pure): ไม่ import store / supabase / konva อะไรเลย
 * → drop-in ได้ทันที. การต่อกับ detectionStore + price DB ดู comment ท้ายไฟล์
 *
 * หน่วย: เมตร (m) สำหรับมิติ, ลบ.ม. (m³) ปริมาตร, ตร.ม. (m²) พื้นที่, kg เหล็ก
 */

// ─────────────────────────────────────────────────────────────
// 1) ค่าคงที่ทางวิศวกรรม (แก้ที่เดียว — กฎ "centralized" ของผู้ใช้)
// ─────────────────────────────────────────────────────────────
export const CONST = {
  SAND_THK: 0.05,      // ทรายหยาบรองพื้น หนา 0.05 ม. (กฎ 14)
  LEAN_THK: 0.05,      // คอนกรีตหยาบ 1:3:5 หนา 0.05 ม. (กฎ 2/14)
  EXCAV_SIDE: 0.50,    // เผื่อขุดข้างละ 0.50 ม. (กฎ 2/14) → +1.0 ต่อมิติ
} as const;

/** น้ำหนักเหล็ก kg/m = d²/162 (d เป็น มม.) — ตารางอ้างอิงไว้ cross-check */
export const REBAR_KG_PER_M: Record<string, number> = {
  RB6: 0.222, RB9: 0.499, RB12: 0.888,           // SR24 เส้นกลม
  DB10: 0.617, DB12: 0.888, DB16: 1.578,         // SD40 ข้ออ้อย
  DB20: 2.466, DB25: 3.853,
};

/** ดึง kg/m: ใช้ตารางก่อน ถ้าไม่มีค่อยคำนวณ d²/162 */
export function barWeightPerM(size: string): number {
  if (REBAR_KG_PER_M[size] != null) return REBAR_KG_PER_M[size];
  const d = parseFloat(size.replace(/[^0-9.]/g, ''));
  if (!d) throw new Error(`อ่านขนาดเหล็กไม่ออก: "${size}"`);
  return (d * d) / 162;
}

// ─────────────────────────────────────────────────────────────
// 2) Types
// ─────────────────────────────────────────────────────────────
/** เหล็กตะแกรงฐาน 1 ชั้น/ทิศ — ระบุได้ 2 โหมด: ตามระยะเรียง หรือ ระบุจำนวนเส้นตรง ๆ */
export interface RebarLayer {
  size: string;          // "DB12", "RB9" ...
  /** โหมด A: ระยะเรียง (ม.) → คำนวณจำนวนเส้นจากความกว้างฐาน */
  spacing?: number;
  /** โหมด B: ระบุจำนวนเส้นตรง ๆ (ถ้าใส่ จะ override spacing) */
  bars?: number;
  /** ทิศ: ตะแกรงล่างปกติมี 2 ทิศ (X,Y). ใส่ true = คิดทั้ง 2 ทิศ (default true) */
  bothWays?: boolean;
  /** ความยาวเส้นกำหนดเอง (ม.) ถ้าไม่ใส่ = มิติฐาน − 2·cover (+ hook) */
  barLengthOverride?: number;
  hook?: number;         // งอปลายต่อข้าง (ม.) default 0
}

/** ตอม่อ (short column) — S2-04 Column Schedule */
export interface PedestalSpec {
  W: number;             // หน้าตัด กว้าง (ม.)
  L: number;             // หน้าตัด ยาว (ม.)
  H: number;             // ความสูง (ม.) — คิด 1.00 ตามแบบ
  vBars: { size: string; count: number };  // เหล็กยืน เช่น {DB12, 8}
  tie: { size: string; spacing: number };  // ปลอก เช่น {RB6, 0.19}
  /** เผื่อฝัง+ทาบเหล็กยืนต่อเส้น (ม.) — ❓ ถ้าไม่ระบุ default 0.40 (~40db) */
  dowel?: number;
  cover?: number;        // default 0.04
}

export interface FootingSpec {
  type: string;          // "F2", "F1"
  W: number;             // กว้าง (ม.)
  L: number;             // ยาว (ม.)
  T: number;             // หนาฐาน (ม.)
  depth: number;         // D — ระดับก้นหลุมจากดินเดิม (ม.) สำหรับงานขุด
  count: number;         // N — จำนวนฐานชนิดนี้
  cover?: number;        // ระยะหุ้มเหล็ก (ม.) default 0.075
  sandThk?: number;      // ทรายรองพื้น (ม.) default CONST.SAND_THK — แบบจริงชนะ default
  leanThk?: number;      // คอนกรีตหยาบ (ม.) default CONST.LEAN_THK
  rebar?: RebarLayer[];  // รายการเหล็กตะแกรง (กฎ 4)
  /** ตอม่อ/pedestal (กฎ 14 + S2-04). ถ้าใส่ จะคิดคอนกรีต+ไม้แบบ+เหล็กยืน+ปลอก
   *  และใช้ปริมาตรของมันหักดินถมกลับ (override pedestalVol) */
  pedestal?: PedestalSpec;
  /** (legacy) ปริมาตรตอม่อ ลบ.ม./ฐาน — ใช้เมื่อไม่ได้ระบุ pedestal เต็ม */
  pedestalVol?: number;
  gridPositions?: string[]; // เช่น ["1A","2A",...] (กฎ 12) — pass-through ไป BOQ
  refSheet?: string;     // "S2-02"
}

export interface FootingQty {
  type: string;
  count: number;
  concrete_m3: number;   // คอนกรีตฐาน
  sand_m3: number;       // ทรายรองพื้น
  lean_m3: number;       // คอนกรีตหยาบ
  excavation_m3: number; // ดินขุด
  backfill_m3: number;   // ดินถมกลับ
  formwork_m2: number;   // ไม้แบบข้างฐาน
  ped_concrete_m3: number;   // คอนกรีตตอม่อ
  ped_formwork_m2: number;   // ไม้แบบตอม่อ
  rebar_kg: number;      // เหล็กรวม (ตะแกรงฐาน + เหล็กยืนตอม่อ + ปลอก)
  rebar_breakdown: Record<string, number>; // kg แยกตามขนาด (สั่งของ/ตัดเหล็ก)
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────
// 3) สูตรหลัก (ข้อ 7) — ต่อ "ชนิดฐาน" 1 รายการ
// ─────────────────────────────────────────────────────────────
export function computeFooting(f: FootingSpec): FootingQty {
  const { W, L, T, depth: D, count: N } = f;
  const cover = f.cover ?? 0.075;
  const warnings: string[] = [];

  if ([W, L, T, D].some((v) => !v || v <= 0))
    warnings.push(`❓ ${f.type}: มีมิติ ≤ 0 หรือยังไม่ระบุ (ต้องได้จาก S2-02)`);

  // ปริมาตร/พื้นที่ (×N)
  const concrete_m3 = W * L * T * N;
  const sandThk = f.sandThk ?? CONST.SAND_THK;
  const leanThk = f.leanThk ?? CONST.LEAN_THK;
  const sand_m3 = W * L * sandThk * N;
  const lean_m3 = W * L * leanThk * N;
  const excavation_m3 = (W + 2 * CONST.EXCAV_SIDE) * (L + 2 * CONST.EXCAV_SIDE) * D * N;
  const ped = f.pedestal;
  const pedVolPer = ped ? ped.W * ped.L * ped.H : (f.pedestalVol ?? 0);
  const pedestalVol = pedVolPer * N;
  const backfill_m3 = excavation_m3 - concrete_m3 - sand_m3 - lean_m3 - pedestalVol;
  const formwork_m2 = 2 * (W + L) * T * N; // ไม้แบบข้าง = เส้นรอบรูป × หนา

  if (backfill_m3 < 0)
    warnings.push(`❓ ${f.type}: ดินถมกลับติดลบ — ตรวจ depth/มิติ`);

  // เหล็ก
  const rebar_breakdown: Record<string, number> = {};
  let rebar_kg = 0;
  for (const r of f.rebar ?? []) {
    const both = r.bothWays ?? true;
    const dirs = both ? 2 : 1;
    // จำนวนเส้นต่อทิศ
    let nBars: number;
    if (r.bars != null) nBars = r.bars;
    else if (r.spacing) {
      const clear = Math.min(W, L) - 2 * cover; // เรียงตามด้านสั้น (ประมาณการ)
      nBars = Math.floor(clear / r.spacing) + 1;
    } else {
      warnings.push(`❓ ${f.type}: เหล็ก ${r.size} ไม่ระบุ spacing/bars`);
      continue;
    }
    // ความยาวต่อเส้น
    const span = Math.max(W, L); // เส้นพาดด้านยาว (ประมาณการ symmetric)
    const barLen = r.barLengthOverride ?? span - 2 * cover + 2 * (r.hook ?? 0);
    const kg = nBars * barLen * barWeightPerM(r.size) * dirs * N;
    rebar_breakdown[r.size] = (rebar_breakdown[r.size] ?? 0) + kg;
    rebar_kg += kg;
  }

  // ── ตอม่อ (S2-04) ──
  let ped_concrete_m3 = 0, ped_formwork_m2 = 0;
  if (ped) {
    const pcover = ped.cover ?? 0.04;
    ped_concrete_m3 = ped.W * ped.L * ped.H * N;
    ped_formwork_m2 = 2 * (ped.W + ped.L) * ped.H * N; // 4 ด้าน
    // เหล็กยืน
    const dowel = ped.dowel ?? 0.40;
    if (ped.dowel == null)
      warnings.push(`❓ ${f.type}: เผื่อฝัง/ทาบเหล็กยืนตอม่อใช้ค่า default 0.40m (S2-04 ไม่ระบุ lap)`);
    const vKg = ped.vBars.count * (ped.H + dowel) * barWeightPerM(ped.vBars.size) * N;
    rebar_breakdown[ped.vBars.size] = (rebar_breakdown[ped.vBars.size] ?? 0) + vKg;
    rebar_kg += vKg;
    // ปลอก
    const nTie = Math.floor(ped.H / ped.tie.spacing) + 1;
    const tieLen = 2 * ((ped.W - 2 * pcover) + (ped.L - 2 * pcover)) + 2 * 0.05; // +งอ
    const tKg = nTie * tieLen * barWeightPerM(ped.tie.size) * N;
    rebar_breakdown[ped.tie.size] = (rebar_breakdown[ped.tie.size] ?? 0) + tKg;
    rebar_kg += tKg;
  }

  const round = (x: number, p = 3) => +x.toFixed(p);
  return {
    type: f.type,
    count: N,
    concrete_m3: round(concrete_m3),
    sand_m3: round(sand_m3),
    lean_m3: round(lean_m3),
    excavation_m3: round(excavation_m3),
    backfill_m3: round(backfill_m3),
    formwork_m2: round(formwork_m2, 2),
    ped_concrete_m3: round(ped_concrete_m3, 3),
    ped_formwork_m2: round(ped_formwork_m2, 2),
    rebar_kg: round(rebar_kg, 1),
    rebar_breakdown: Object.fromEntries(
      Object.entries(rebar_breakdown).map(([k, v]) => [k, round(v, 1)])
    ),
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────
// 4) ชั้น "ราคา" — แยกจากปริมาณ (ปริมาณ deterministic, ราคา = ตาราง × Factor F)
// ─────────────────────────────────────────────────────────────
/** ราคาต่อหน่วยจาก price DB (โหลด 120 รายการ OBEC+MOC แล้ว) */
export interface UnitPrice {
  material: number; // บาท/หน่วย
  labor: number;    // บาท/หน่วย
}
export type PriceKey =
  | 'concrete_m3' | 'sand_m3' | 'lean_m3'
  | 'excavation_m3' | 'backfill_m3' | 'formwork_m2' | 'rebar_kg';

export interface CostResult {
  rows: Array<{
    key: PriceKey; qty: number; unit: string;
    matRate: number; labRate: number;
    matCost: number; labCost: number; lineCost: number;
  }>;
  subtotal: number;     // ก่อน Factor F
  factorF: number;
  total: number;        // subtotal × Factor F
  warnings: string[];
}

const UNIT_LABEL: Record<PriceKey, string> = {
  concrete_m3: 'ลบ.ม.', sand_m3: 'ลบ.ม.', lean_m3: 'ลบ.ม.',
  excavation_m3: 'ลบ.ม.', backfill_m3: 'ลบ.ม.', formwork_m2: 'ตร.ม.', rebar_kg: 'kg',
};

/**
 * คิดราคาจากปริมาณ + ตารางราคา + Factor F
 * @param factorF ดึงจาก effectiveFactorF() เดิมของระบบ (CGD 2567, 12 ตาราง)
 */
export function computeCost(
  q: FootingQty,
  prices: Partial<Record<PriceKey, UnitPrice>>,
  factorF: number
): CostResult {
  const keys: PriceKey[] = [
    'concrete_m3', 'sand_m3', 'lean_m3',
    'excavation_m3', 'backfill_m3', 'formwork_m2', 'rebar_kg',
  ];
  const warnings: string[] = [];
  const rows = keys.map((key) => {
    const qty = q[key];
    const p = prices[key];
    if (!p) warnings.push(`❓ ไม่มีราคากลางของ ${key} ในตาราง — คิดเป็น 0`);
    const matRate = p?.material ?? 0;
    const labRate = p?.labor ?? 0;
    const matCost = qty * matRate;
    const labCost = qty * labRate;
    return {
      key, qty, unit: UNIT_LABEL[key], matRate, labRate,
      matCost: +matCost.toFixed(2), labCost: +labCost.toFixed(2),
      lineCost: +(matCost + labCost).toFixed(2),
    };
  });
  const subtotal = +rows.reduce((s, r) => s + r.lineCost, 0).toFixed(2);
  const total = +(subtotal * factorF).toFixed(2);
  return { rows, subtotal, factorF, total, warnings };
}

// ─────────────────────────────────────────────────────────────
// 5) ตัวช่วยรวมหลายชนิดฐาน
// ─────────────────────────────────────────────────────────────
export function computeAll(specs: FootingSpec[]): FootingQty[] {
  return specs.map(computeFooting);
}

/*
 * ── การต่อกับระบบ (adapter — เขียนตอน wire จริง) ─────────────
 * 1) detectionStore.boxes[]  →  FootingSpec[]
 *      - type มาจากกล่อง (F2/F1)
 *      - W,L,T,depth,rebar  ← มิติจาก S2-02 (full engine อ่าน schedule)
 *      - count = countByType()
 *      - gridPositions/refSheet = pass-through
 *      ⚠️ GATING: ถ้ายังไม่ได้ W/L/T/depth/rebar จาก S2-02 → ใส่ depth=0
 *        ฟังก์ชันจะ push warning ❓ ให้คนยืนยันก่อน (ไม่เดาเงียบ — กฎ 6)
 * 2) prices ← price DB 120 รายการ (map ชื่องาน → {material,labor})
 * 3) factorF ← effectiveFactorF() เดิม (อย่า hardcode 1.2768 — โดนถอดแล้ว)
 * 4) แนบรูป crop จากพิกัดกล่อง (box → cropRef) ไป BOQ row เพื่อ audit
 */
