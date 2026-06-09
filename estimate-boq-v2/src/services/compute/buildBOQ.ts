/**
 * buildBOQ.ts — ประกอบ BOQ rows (deterministic) จากผล AI extract
 * --------------------------------------------------------------------------
 * pipeline:  AI extract (items[])
 *              → boqAdapter.buildSpecs  → FootingSpec[] / BeamSpec[] / SlabSpec[]
 *              → footingCompute/beamCompute/computeSlab  (ปริมาณ deterministic)
 *              → AIItem[] (sub_items = วัสดุ+ค่าแรง) → importItemsToBoq
 *
 * หลักการ (Golden Rule): "ตัวเลขใน BOQ มาจาก compute layer ไม่ใช่ AI"
 *   - AI ให้แค่ count + มิติ + เหล็ก (ผ่าน boqAdapter)
 *   - ปริมาตร/พื้นที่/น้ำหนักเหล็ก/งานดิน คำนวณที่นี่ → reproduce ได้
 *
 * วัสดุสิ้นเปลือง (consumables) ที่ core ไม่ได้คิด เติมในชั้นนี้:
 *   - ลวดผูกเหล็ก: อัตราจาก CONSUMABLE_RATIOS.tieWirePct (consumables.ts) — อย่า hardcode ค่าซ้ำที่นี่
 *   - ตะปู: อัตราจาก CONSUMABLE_RATIOS.nailsPerM2 (consumables.ts) — อย่า hardcode ค่าซ้ำที่นี่
 *
 * pure module: ไม่มี dependency กับ store/supabase/react
 */
import type { AIItem, AIMaterial } from '@/types/ai';
import { buildSpecs, specsFromMarks } from './boqAdapter.ts';
import type { MarkDims } from '@/stores/detectionStore';
import {
  computeFooting,
  type FootingQty,
  type PriceKey,
  type UnitPrice,
} from './footingCompute.ts';
import { computeBeam, computeSlab, type BeamQty, type SlabQty } from './beamCompute.ts';
import { computeConsumables } from './consumables.ts';
import { enumerateGrid, type GridDef } from './gridModel.ts';
import { reconcileGridCount } from './gridReconcile.ts';
import { splitMarks, categoryForMark } from '../markParse.ts';

/** RFI flags — ข้อสมมุติที่ต้องให้คนยืนยัน (ติดมากับทุก build) */
const FIXED_RFI: string[] = [
  '⚠️ ตอม่อ: สมมุติปลอก RB6 — ถ้าแบบระบุ RB9 ต้องแก้ (S2-04)',
  '⚠️ พื้น: แยก GS (slab on grade) vs PS (post-tension/แขวน) ยังไม่ชัด — ยืนยันชนิด',
  '⚠️ ทรายรองพื้น: ใช้ค่า default 0.05 ม. — ถ้าแบบระบุ 0.10 ม. ต้องแก้',
  '⚠️ เหล็กยืนตอม่อ: เผื่อทาบ/ฝัง (dowel-lap) default 0.40 ม. (~40db) ถ้า S2-04 ไม่ระบุ lap',
];

// ─────────────────────────────────────────────────────────────
// helper สร้าง sub_item (1 บรรทัดวัสดุ/ค่าแรง)
// ─────────────────────────────────────────────────────────────
function sub(
  name: string,
  qty: number,
  unit: string,
  kind: 'material' | 'labor',
  unitPrice = 0,
  note?: string,
): AIMaterial {
  return {
    name,
    qty,
    total_qty: qty,
    unit,
    unit_price: unitPrice,
    kind,
    ...(note ? { note } : {}),
  };
}

/** ดึงราคาวัสดุ/ค่าแรงจากตาราง (ถ้ามี) */
function rate(
  prices: Partial<Record<PriceKey, UnitPrice>> | undefined,
  key: PriceKey,
): UnitPrice {
  return prices?.[key] ?? { material: 0, labor: 0 };
}

// ─────────────────────────────────────────────────────────────
// ฐานราก: FootingQty → AIItem (sub_items ครบ)
// ─────────────────────────────────────────────────────────────
function footingToItem(
  q: FootingQty,
  prices: Partial<Record<PriceKey, UnitPrice>> | undefined,
): AIItem {
  const subs: AIMaterial[] = [];

  const concrete = rate(prices, 'concrete_m3');
  const sand = rate(prices, 'sand_m3');
  const lean = rate(prices, 'lean_m3');
  const formwork = rate(prices, 'formwork_m2');
  const rebar = rate(prices, 'rebar_kg');
  const excav = rate(prices, 'excavation_m3');
  const backfill = rate(prices, 'backfill_m3');

  // คอนกรีตฐาน (วัสดุ + ค่าเท)
  if (q.concrete_m3 > 0) {
    subs.push(sub('คอนกรีตฐานราก', q.concrete_m3, 'ลบ.ม.', 'material', concrete.material));
    if (concrete.labor > 0)
      subs.push(sub('ค่าเทคอนกรีตฐาน', q.concrete_m3, 'ลบ.ม.', 'labor', concrete.labor));
  }
  // คอนกรีตตอม่อ
  if (q.ped_concrete_m3 > 0) {
    subs.push(
      sub('คอนกรีตตอม่อ', q.ped_concrete_m3, 'ลบ.ม.', 'material', concrete.material),
    );
    if (concrete.labor > 0)
      subs.push(sub('ค่าเทคอนกรีตตอม่อ', q.ped_concrete_m3, 'ลบ.ม.', 'labor', concrete.labor));
  }
  // ทรายรองพื้น
  if (q.sand_m3 > 0)
    subs.push(sub('ทรายหยาบรองพื้น', q.sand_m3, 'ลบ.ม.', 'material', sand.material));
  // คอนกรีตหยาบ (lean)
  if (q.lean_m3 > 0)
    subs.push(sub('คอนกรีตหยาบรองก้นหลุม', q.lean_m3, 'ลบ.ม.', 'material', lean.material));
  // ไม้แบบ (ฐาน + ตอม่อ)
  const formwork_m2 = q.formwork_m2 + q.ped_formwork_m2;
  if (formwork_m2 > 0) {
    subs.push(sub('ไม้แบบหล่อคอนกรีต', formwork_m2, 'ตร.ม.', 'material', formwork.material));
    if (formwork.labor > 0)
      subs.push(sub('ค่าประกอบไม้แบบ', formwork_m2, 'ตร.ม.', 'labor', formwork.labor));
  }
  // เหล็กเสริม — แยกตามขนาด (สั่งของ/ตัดเหล็ก) · เก็บ breakdown รายชิ้นใน note
  for (const [size, kg] of Object.entries(q.rebar_breakdown)) {
    if (kg > 0)
      subs.push(
        sub(`เหล็กเสริม ${size}`, kg, 'กก.', 'material', rebar.material, q.rebar_notes[size]),
      );
  }
  // เหล็กรัดรอบฐาน RB9 (แยกจากตะแกรง)
  if (q.tie_rebar_kg > 0)
    subs.push(
      sub(
        `เหล็กรัดรอบฐาน ${q.tie_rebar_size ?? ''}`.trim(),
        q.tie_rebar_kg,
        'กก.',
        'material',
        rebar.material,
      ),
    );
  if (rebar.labor > 0 && q.rebar_kg > 0)
    subs.push(sub('ค่าผูก/ตัด/ดัดเหล็ก', q.rebar_kg, 'กก.', 'labor', rebar.labor));
  // งานดิน (ค่าแรง)
  if (q.excavation_m3 > 0)
    subs.push(sub('ดินขุดหลุมฐานราก', q.excavation_m3, 'ลบ.ม.', 'labor', excav.labor));
  if (q.backfill_m3 > 0)
    subs.push(sub('ดินถมกลับ', q.backfill_m3, 'ลบ.ม.', 'labor', backfill.labor));

  // ── consumables (estimated — อัตราส่วนจาก CONSUMABLE_RATIOS) ──
  const con = computeConsumables({ rebar_kg: q.rebar_kg, formwork_m2 });
  if (con.tieWire_kg > 0)
    subs.push(sub('ลวดผูกเหล็ก', con.tieWire_kg, 'กก.', 'material'));
  if (con.nails_kg > 0) subs.push(sub('ตะปู', con.nails_kg, 'กก.', 'material'));
  if (con.waler_m > 0)
    subs.push(sub('ไม้เคร่า/ตงยึดไม้แบบ', con.waler_m, 'ม.', 'material'));

  return {
    category: 'ฐานราก',
    name: `${q.type} ฐานราก (${q.count} ฐาน)`,
    quantity: q.count,
    unit: 'ฐาน',
    source: 'คำนวณ',
    confidence: 'calculated',
    sub_items: subs,
    notes: q.warnings.length > 0 ? q.warnings.join(' · ') : undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// คาน: BeamQty → AIItem
// ─────────────────────────────────────────────────────────────
function beamToItem(
  q: BeamQty,
  prices: Partial<Record<PriceKey, UnitPrice>> | undefined,
): AIItem {
  const subs: AIMaterial[] = [];
  const concrete = rate(prices, 'concrete_m3');
  const formwork = rate(prices, 'formwork_m2');
  const rebar = rate(prices, 'rebar_kg');

  if (q.concrete_m3 > 0)
    subs.push(sub('คอนกรีตคาน', q.concrete_m3, 'ลบ.ม.', 'material', concrete.material));
  if (q.formwork_m2 > 0)
    subs.push(sub('ไม้แบบคาน', q.formwork_m2, 'ตร.ม.', 'material', formwork.material));
  for (const [size, kg] of Object.entries(q.rebar_breakdown)) {
    if (kg > 0)
      subs.push(sub(`เหล็กเสริม ${size}`, kg, 'กก.', 'material', rebar.material));
  }
  const con = computeConsumables({ rebar_kg: q.rebar_kg, formwork_m2: q.formwork_m2 });
  if (con.tieWire_kg > 0)
    subs.push(sub('ลวดผูกเหล็ก', con.tieWire_kg, 'กก.', 'material'));
  if (con.nails_kg > 0) subs.push(sub('ตะปู', con.nails_kg, 'กก.', 'material'));
  if (con.waler_m > 0)
    subs.push(sub('ไม้เคร่า/ตงยึดไม้แบบ', con.waler_m, 'ม.', 'material'));

  return {
    category: 'งานคาน',
    name: `${q.type} คาน (${q.pieces_total} ตัว · ${q.length_total_m} ม.)`,
    quantity: q.pieces_total,
    unit: 'ตัว',
    source: 'คำนวณ',
    confidence: 'calculated',
    sub_items: subs,
    notes: q.warnings.length > 0 ? q.warnings.join(' · ') : undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// พื้น: SlabQty → AIItem
// ─────────────────────────────────────────────────────────────
function slabToItem(
  q: SlabQty,
  prices: Partial<Record<PriceKey, UnitPrice>> | undefined,
): AIItem {
  const subs: AIMaterial[] = [];
  const concrete = rate(prices, 'concrete_m3');
  const sand = rate(prices, 'sand_m3');
  const rebar = rate(prices, 'rebar_kg');

  if (q.concrete_m3 > 0)
    subs.push(sub('คอนกรีตพื้น', q.concrete_m3, 'ลบ.ม.', 'material', concrete.material));
  if (q.sand_m3 > 0)
    subs.push(sub('ทรายหยาบรองพื้น', q.sand_m3, 'ลบ.ม.', 'material', sand.material));
  if (q.mesh_kg > 0)
    subs.push(sub('ตะแกรงเหล็ก (wire mesh)', q.mesh_kg, 'กก.', 'material', rebar.material));

  return {
    category: 'งานพื้น',
    name: `${q.name} พื้น`,
    quantity: 1,
    unit: 'รายการ',
    source: 'คำนวณ',
    confidence: 'calculated',
    sub_items: subs,
    notes: q.warnings.length > 0 ? q.warnings.join(' · ') : undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
/** member ที่ติดป้าย/ยืนยันบน canvas — ใช้ override จำนวนฐานตาม mark (structural subset) */
export interface MemberCountInput {
  /** รหัส — อาจประกอบ "F2,C2" (split เป็น token นับฐาน/เสาแยก) */
  mark: string;
  status: 'draft' | 'confirmed';
  /** พื้นที่ของชิ้นพื้น (slab) ตร.ม. — ใช้ sum ต่อ mark เป็น slabAreaByMark */
  areaSqm?: number;
}

export interface BuildBOQOptions {
  /** ผล AI extract (analysis.result.items) */
  extract: AIItem[];
  /**
   * ตารางราคา (optional) — unit_price เป็น "ราคาดิบ" (วัสดุ/ค่าแรง) ก่อน Factor F
   * ⚠️ ห้าม bake Factor F ลง row ที่นี่ — Factor F คิดครั้งเดียวที่ยอดรวม BOQ
   *    ผ่าน effectiveFactorF() (core/boqCalc) เพื่อกัน double-apply (ห้าม hardcode)
   * ถ้าไม่ส่ง prices → unit_price = 0 (ปริมาณยังถูกต้อง เติมราคาทีหลังได้)
   */
  prices?: Partial<Record<PriceKey, UnitPrice>>;
  /**
   * ชิ้นงานที่ระบายบน canvas (optional) — ถ้าส่งมา:
   *   - จำนวนฐานต่อ mark = นับจาก member (override count จาก AI extract)
   *   - member ที่ยัง draft → warning "ยังไม่ตรวจ N ชิ้น"
   */
  members?: MemberCountInput[];
  /**
   * มิติต่อ mark ที่ผู้ใช้พิมพ์ (ทาง A) — ถ้ามี entry และมี members:
   *   ใช้ specsFromMarks(tally, markDims) แทน buildSpecs(extract) (compute โดยไม่พึ่ง AI)
   */
  markDims?: Record<string, MarkDims>;
  /**
   * นิยาม grid ฐานราก (optional, กฎ 11) — ถ้าส่งมาพร้อม members:
   *   enumerateGrid → byMark(grid-first) → reconcile กับ tally.footingByMark
   *   ต่าง → push 🚩 warning + ติดธง provisional ฐานนั้น (ไม่แตะ count — คนตัดสิน)
   */
  grid?: GridDef;
}

/**
 * นับ member ต่อ mark — ฐาน/เสานับแยก category (กัน mark ชนกันข้ามหมวด)
 *  + จำนวน draft รวมทุกหมวด (ไว้เตือน "ยังไม่ยืนยัน")
 */
export interface MemberTally {
  footingByMark: Map<string, number>;
  columnByMark: Map<string, number>;
  /** จำนวน tag คาน ต่อ mark — cross-check กับ pieces.sum(count) ใน dict */
  beamByMark: Map<string, number>;
  /** รวมพื้นที่ slab (ตร.ม.) ต่อ mark — ปริมาณพื้นจาก tag */
  slabAreaByMark: Map<string, number>;
  draftTotal: number;
}

function tallyMembers(members: MemberCountInput[]): MemberTally {
  const footingByMark = new Map<string, number>();
  const columnByMark = new Map<string, number>();
  const beamByMark = new Map<string, number>();
  const slabAreaByMark = new Map<string, number>();
  let draftTotal = 0;
  for (const m of members) {
    // รหัสประกอบ "F2,C2" → นับ F2 เป็นฐาน + C2 เป็นเสา แยก token
    for (const token of splitMarks(m.mark)) {
      const cat = categoryForMark(token);
      if (cat === 'footing') {
        footingByMark.set(token, (footingByMark.get(token) ?? 0) + 1);
      } else if (cat === 'column') {
        columnByMark.set(token, (columnByMark.get(token) ?? 0) + 1);
      } else if (cat === 'beam') {
        beamByMark.set(token, (beamByMark.get(token) ?? 0) + 1);
      } else if (cat === 'slab') {
        slabAreaByMark.set(
          token,
          (slabAreaByMark.get(token) ?? 0) + (m.areaSqm ?? 0),
        );
      }
    }
    if (m.status === 'draft') draftTotal += 1;
  }
  return { footingByMark, columnByMark, beamByMark, slabAreaByMark, draftTotal };
}

export interface BuildBOQResult {
  /** AIItem[] พร้อม import เข้า BOQ (sub_items = วัสดุ+ค่าแรง) */
  items: AIItem[];
  /** ❓/⚠️ ที่ต้องให้คนยืนยัน (adapter + compute + RFI) */
  warnings: string[];
}

export function buildBOQ(opts: BuildBOQOptions): BuildBOQResult {
  const tally = opts.members ? tallyMembers(opts.members) : null;
  const markDims = opts.markDims;
  // ทาง A: มี member + มีมิติที่พิมพ์ ≥1 → compute จาก tag+dict (ไม่พึ่ง AI extract)
  const fromMarks =
    tally != null && markDims != null && Object.keys(markDims).length > 0;

  const specs = fromMarks
    ? specsFromMarks({ tally, markDims })
    : buildSpecs({ extract: opts.extract ?? [] });
  const warnings: string[] = [...specs.warnings];
  const items: AIItem[] = [];

  // grid-first reconcile (กฎ 11): เทียบจำนวนที่ grid นับได้ กับที่ระบายบนแบบ (tally)
  //   ไม่แตะ count — แค่ติดธง 🚩 ให้คนตรวจ + mark provisional ฐานที่ต่าง
  const flaggedFootingMarks = new Set<string>();
  if (opts.grid && tally) {
    // กันแครช: GridDef ใช้ไม่ได้ enumerateGrid จะ throw → ห่อไว้ ไม่ให้ทะลุไปทำ PaintPanel จอขาว
    let enumerated: ReturnType<typeof enumerateGrid> | null = null;
    try {
      enumerated = enumerateGrid(opts.grid);
    } catch (e) {
      warnings.push(
        `⚠️ grid ฐานรากไม่สมเหตุผล — ข้ามการเทียบ (${e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'})`,
      );
    }
    if (enumerated) {
      // normalize enumerated keys → UPPER (tally ฝั่งคนแท็กเป็น UPPER เสมอจาก splitMarks)
      //   ถ้า GridDef กรอก "f2"/"F2 " จะได้ไม่นับเป็นคนละ mark → ธงเพี้ยน
      const enumUpper = new Map<string, number>();
      for (const [k, v] of enumerated.byMark) {
        const key = k.trim().toUpperCase();
        enumUpper.set(key, (enumUpper.get(key) ?? 0) + v);
      }
      const rec = reconcileGridCount(enumUpper, tally.footingByMark);
      for (const d of rec.diffs) {
        if (d.ok) continue;
        flaggedFootingMarks.add(d.mark.trim().toUpperCase());
        warnings.push(
          `🚩 ${d.mark}: grid นับได้ ${d.enumerated} ฐาน แต่ระบายบนแบบ ${d.tagged} ฐาน (ต่าง ${d.diff > 0 ? '+' : ''}${d.diff}) — ตรวจซ้ำ`,
        );
      }
    }
  }

  for (const f of specs.footings) {
    // เส้น AI extract: override จำนวนฐานตามที่ระบายบนแบบ (เส้น marks count = ถูกอยู่แล้ว)
    let spec = f;
    if (!fromMarks && tally) {
      const marked = tally.footingByMark.get(f.type.trim().toUpperCase());
      if (marked != null && marked > 0 && marked !== f.count) {
        spec = { ...f, count: marked };
        warnings.push(
          `ℹ️ ${f.type}: ใช้จำนวนจากการระบายบนแบบ (${marked} ฐาน) แทนค่า AI (${f.count})`,
        );
      }
    }
    if (flaggedFootingMarks.has(spec.type.trim().toUpperCase())) {
      spec = { ...spec, provisional: true };
    }
    const q = computeFooting(spec);
    warnings.push(...q.warnings);
    items.push(footingToItem(q, opts.prices));
  }
  for (const b of specs.beams) {
    const q = computeBeam(b);
    warnings.push(...q.warnings);
    items.push(beamToItem(q, opts.prices));
  }
  for (const s of specs.slabs) {
    const q = computeSlab(s);
    warnings.push(...q.warnings);
    items.push(slabToItem(q, opts.prices));
  }

  if (tally && tally.draftTotal > 0) {
    warnings.push(
      `❓ ยังไม่ตรวจ ${tally.draftTotal} ชิ้น (ระบายบนแบบแล้วแต่ยังไม่ยืนยัน) — ยืนยันก่อนสรุป BOQ`,
    );
  }

  warnings.push(...FIXED_RFI);
  return { items, warnings };
}
