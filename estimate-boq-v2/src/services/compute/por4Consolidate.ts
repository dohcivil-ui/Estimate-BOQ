/**
 * por4Consolidate.ts — ชั้นรวม ปร.4: รวบ BOQ rows (net) → ปร.4 rows
 * --------------------------------------------------------------------------
 * pipeline:
 *   BOQ (net, sub-element) → classify → merge by (section, materialKey, role)
 *     → apply allowance (per-key policy) → re-derive consumables → qtyFinal=ceil
 *
 * สเปกหลัก (สรุป):
 *   - dictionary copy name ตรงจาก buildBOQ (กัน Thai codepoint เพี้ยน)
 *   - allowance policy ต้อง declare ทุก key — ไม่มี = throw POLICY_MISSING
 *   - ห้าม merge ข้าม role (วัสดุไม้แบบ 70 ตร.ม. ≠ ค่าแรง 100 ตร.ม.)
 *   - consumables (tiewire/nails) re-derive แทนค่า ไม่บวกเพิ่ม
 *   - input BOQ ต้อง net (wastePct=0) — ถ้าไม่ใช่ push warning BOQ_NOT_NET (ไม่ throw)
 *
 * pure module: ไม่ import store/supabase/react
 */
import type { BOQItem, DisciplineGroup, Discipline } from '@/types/boq';
import {
  REBAR,
  EXCAVATION_ALLOWANCE_PCT,
  FILL_ALLOWANCE_PCT,
  TIE_WIRE_KG_PER_TON,
  FORMWORK,
} from '@/data/cgdAllowance';
import { laborPresetForRebar } from '@/core/wage809';

export interface ConsolidatePor4Options {
  /**
   * Override บาท/ตัน per size (เช่น 'DB12': 3600) — ใช้แทน rate จาก ว.809
   * ประโยชน์: reproduce เอกสารเก่าที่ใช้บัญชีค่าแรงคนละฉบับ
   * ไม่ส่ง → ใช้ ว.809 ตาม laborPresetForRebar()
   */
  laborRateBySizeTon?: Record<string, number>;
}

export type Role = 'material' | 'labor';

export interface AllowancePolicy {
  /** %เผื่อที่ต้องบวก (0 = net) */
  pct: number;
  /** อ้างอิงแหล่งที่ค่ามาจาก (debug/traceability) */
  ref: string;
  /** consumable ที่ต้อง re-derive จาก totals หลัง merge (ห้าม sum BOQ rows ตรงๆ) */
  derived?: boolean;
}

/**
 * Por4Row — dual-column ตามแบบ ปร.4 ราชการ (วัสดุ | ค่าแรง ในแถวเดียว)
 * - เมื่อ qty ของ material + labor ตรงกัน (เช่น คอนกรีต 15 ลบ.ม. ใช้ทั้งซื้อ+เท) → แถวเดียว 2 คอลัมน์
 * - qty ต่าง (เช่น ไม้แบบ material 70 ตร.ม. · ค่าแรง 100 ตร.ม.) → 2 แถวแยก
 * - material-only หรือ labor-only → แถวเดียว (อีกฝั่ง undefined)
 * - rebar:labor (ค่าผูก/ตัด/ดัดเหล็ก) ฝังลงรายขนาดของ rebar:{size} material → ไม่มีแถวรวมแยก
 */
export interface Por4Row {
  section: string;
  materialKey?: string;
  name: string;
  unit: string;
  qtyNet: number;
  allowance?: { pct: number; ref: string };
  qtyAfterAllowance: number;
  qtyFinal: number;
  materialUnitPrice?: number;
  materialAmount?: number;
  laborUnitPrice?: number;
  laborAmount?: number;
  /** = (materialAmount ?? 0) + (laborAmount ?? 0) */
  totalAmount: number;
  sourceItemIds: string[];
  flags?: string[];
}

/** internal draft (มี role + unitPrice + amount ระหว่าง pipeline ยังไม่ pair) */
interface RowDraft {
  section: string;
  materialKey?: string;
  name: string;
  unit: string;
  qtyNet: number;
  allowance?: { pct: number; ref: string };
  qtyAfterAllowance: number;
  qtyFinal: number;
  role: Role;
  unitPrice: number;
  amount: number;
  /** ค่าแรงผูกเหล็กที่ฝังลงในแถว rebar:{size} material — มีค่าเฉพาะแถวที่ได้รับการกระจาย */
  laborSidecar?: { unitPrice: number };
  sourceItemIds: string[];
  flags?: string[];
}

export interface Por4Result {
  rows: Por4Row[];
  directCost: number;
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════
// MATERIAL_KEY_MAP — exact-match dictionary
// (ชื่อทั้งหมด copy ตรงจาก src/services/compute/buildBOQ.ts — กัน codepoint เพี้ยน)
// ═══════════════════════════════════════════════════════════════════════
export const MATERIAL_KEY_MAP: Record<string, string> = {
  // ── คอนกรีต (footing/beam/slab/pedestal) → concrete:c2 (default ค.2)
  คอนกรีตฐานราก: 'concrete:c2',
  คอนกรีตตอม่อ: 'concrete:c2',
  คอนกรีตคาน: 'concrete:c2',
  คอนกรีตพื้น: 'concrete:c2',
  // ── คอนกรีตหยาบรองก้นหลุม → concrete:lean (ค.1:3:5)
  คอนกรีตหยาบรองก้นหลุม: 'concrete:lean',
  // ── ทรายรองพื้น (เผื่อยุบ 25%)
  ทรายหยาบรองพื้น: 'sand:bedding',
  // ── ไม้แบบ (panel)
  ไม้แบบหล่อคอนกรีต: 'formwork:panel',
  ไม้แบบคาน: 'formwork:panel',
  // ── ไม้คร่าวยึดแบบ (waler) — name ใช้คำถูก "ไม้เคร่า/..."
  'ไม้เคร่า/ตงยึดไม้แบบ': 'formwork:waler',
  // ── ค่าแรง (role=labor — merge key แยกจาก material อัตโนมัติ)
  ค่าเทคอนกรีตฐาน: 'concrete:c2',
  ค่าเทคอนกรีตตอม่อ: 'concrete:c2',
  ค่าประกอบไม้แบบ: 'formwork:panel',
  // ค่าแรงผูกเหล็ก = aggregate ทุกขนาด → key พิเศษ
  'ค่าผูก/ตัด/ดัดเหล็ก': 'rebar:labor',
  // ── งานดิน
  ดินขุดหลุมฐานราก: 'earth:excavation',
  ดินถมกลับ: 'earth:backfill',
  // ── ตะแกรงเหล็กสำเร็จรูป (wire mesh แบบแผ่น)
  'ตะแกรงเหล็ก (wire mesh)': 'rebar:mesh',
  // ── consumables
  ลวดผูกเหล็ก: 'consumable:tiewire',
  ตะปู: 'consumable:nails',
};

// ── เหล็กเสริม + เหล็กรัดรอบฐาน: gen entry ต่อขนาดทุกตัวใน REBAR
//    name pattern จาก buildBOQ: `เหล็กเสริม ${size}` / `เหล็กรัดรอบฐาน ${size}`
for (const size of Object.keys(REBAR)) {
  MATERIAL_KEY_MAP[`เหล็กเสริม ${size}`] = `rebar:${size}`;
  MATERIAL_KEY_MAP[`เหล็กรัดรอบฐาน ${size}`] = `rebar:${size}`;
}

// ═══════════════════════════════════════════════════════════════════════
// ALLOWANCE_POLICY — ทุก key ต้อง declare ชัด (throw ถ้าไม่มี)
// ═══════════════════════════════════════════════════════════════════════
function buildPolicyMap(): Record<string, AllowancePolicy> {
  const map: Record<string, AllowancePolicy> = {
    // คอนกรีต (net — เผื่อรวมในมวลรวมต่อ ลบ.ม. แล้ว — ไม่เผื่อซ้ำที่ qty)
    'concrete:c2': { pct: 0, ref: 'net (CONCRETE_MIX includes overage)' },
    'concrete:lean': { pct: 0, ref: 'net (CONCRETE_MIX includes overage)' },
    // ทรายรองพื้น (เผื่อยุบ 25%)
    'sand:bedding': {
      pct: FILL_ALLOWANCE_PCT.sandSubbase,
      ref: 'cgdAllowance.FILL_ALLOWANCE_PCT.sandSubbase',
    },
    // ดินขุด (เผื่อ 30%) — apply ทั้ง material และ labor (qty ขุดเดียวกัน)
    'earth:excavation': {
      pct: EXCAVATION_ALLOWANCE_PCT,
      ref: 'cgdAllowance.EXCAVATION_ALLOWANCE_PCT',
    },
    'earth:backfill': { pct: 0, ref: 'net (no allowance per CGD)' },
    // ไม้แบบ (net — ลด reuse ที่ชั้น formworkReuse ไม่ใช่ที่ qty allowance)
    'formwork:panel': { pct: 0, ref: 'net (reuse fraction applied elsewhere)' },
    'formwork:waler': { pct: 0, ref: 'net' },
    // labor ผูก/ตัด/ดัดเหล็ก — ปร.4 ราชการคิดค่าแรงเหล็กบน qty เดียวกับวัสดุ (รวมเผื่อ)
    // ดู docs/knowledge/pr4-example-municipal-building.md ตาราง 1.1 (ค่าแรงเหล็ก = qty วัสดุหลังเผื่อ)
    // → derive จาก rebarMaterialKgAfter เหมือน tiewire (ฐานเดียวกัน)
    'rebar:labor': {
      pct: 0,
      ref: 'derived from rebar totals after allowance (ปร.4 ตาราง 1.1)',
      derived: true,
    },
    // ตะแกรงเหล็กสำเร็จรูป (wire mesh แบบแผ่น) — สั่งผลิตตามขนาด ไม่มีระยะทาบ
    // กรณีตะแกรงแบบม้วน (คลี่ปู ต้องทาบต่อผืน) = คนละเงื่อนไข → เพิ่ม key rebar:mesh_roll ภายหลัง ห้ามใช้ key นี้แทน
    'rebar:mesh': {
      pct: 0,
      ref: 'net — ตะแกรงสำเร็จรูปแบบแผ่น มอก.737-2549 สั่งผลิตตามขนาด ไม่มีระยะทาบ (ยืนยันโดยวิศวกร)',
    },
    // consumables — derived จาก totals หลัง merge (อย่าเชื่อ sum ของ BOQ)
    'consumable:tiewire': {
      pct: 0,
      ref: 'derived from rebar totals (TIE_WIRE_KG_PER_TON)',
      derived: true,
    },
    'consumable:nails': {
      pct: 0,
      ref: 'derived from formwork totals (FORMWORK.nailKgPerSqm)',
      derived: true,
    },
  };
  // เหล็กเสริม per-diameter (REBAR[size].wastePct)
  for (const [size, spec] of Object.entries(REBAR)) {
    map[`rebar:${size}`] = {
      pct: spec.wastePct,
      ref: `cgdAllowance.REBAR.${size}.wastePct`,
    };
  }
  return map;
}

export const ALLOWANCE_POLICY: Record<string, AllowancePolicy> =
  buildPolicyMap();

/**
 * ปัดขึ้น 2 ตำแหน่งทศนิยม (+ epsilon กัน float, 100×1.09 → 109.0000…1 ไม่กลายเป็น 109.01)
 * ปร.4 สพฐ. ปัจจุบันใช้ 2dp (เช่น 5.42 ลบ.ม.) — ไม่ใช่จำนวนเต็มแบบ ปร.4 ฉบับ 2544
 * (ยืนยันโดยวิศวกร 10 มิ.ย. 2569 จากไฟล์ตัวอย่าง สพฐ.)
 * หมายเหตุ rebar: คง "กก." ที่ชั้นนี้ · การแปลง "ตัน 3dp" เป็นเรื่องชั้น export ห้ามทำที่นี่
 */
const ceil2dp = (x: number): number => Math.ceil(x * 100 - 1e-7) / 100;

function getPolicy(key: string): AllowancePolicy {
  const p = ALLOWANCE_POLICY[key];
  if (!p) {
    throw new Error(
      `POLICY_MISSING: ไม่มี allowance policy สำหรับ key "${key}" — ` +
        `เพิ่ม entry ใน ALLOWANCE_POLICY ก่อนใช้`,
    );
  }
  return p;
}

// ═══════════════════════════════════════════════════════════════════════
// classify
// ═══════════════════════════════════════════════════════════════════════
interface Classified {
  item: BOQItem;
  discipline: Discipline;
  section: string;
  materialKey: string | null; // null = UNMAPPED
}

function sectionFromCategory(category: string): string {
  // ตอนนี้มีแต่ฐานราก → '1.1' · อื่นๆ ใช้ category as-is (เผื่ออนาคต)
  if (category === 'ฐานราก') return '1.1';
  return category;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN: consolidatePor4
// ═══════════════════════════════════════════════════════════════════════
export function consolidatePor4(
  groups: DisciplineGroup[],
  options: ConsolidatePor4Options = {},
): Por4Result {
  const warnings: string[] = [];
  const classified: Classified[] = [];

  for (const g of groups) {
    for (const it of g.items) {
      // assertion: input ต้อง net (wastePct=0) — ถ้าไม่ใช่ → warning
      if (it.wastePct !== 0) {
        warnings.push(
          `BOQ_NOT_NET: "${it.name}" wastePct=${it.wastePct}% (ปร.4 คาด net) — ใช้ qty เดิม คำนวณ allowance ที่ปร.4 แทน`,
        );
      }
      const key = MATERIAL_KEY_MAP[it.name] ?? null;
      classified.push({
        item: it,
        discipline: g.discipline,
        section: sectionFromCategory(it.category),
        materialKey: key,
      });
    }
  }

  // แยก: mapped (รวม consumables ที่จะ re-derive) vs unmapped (passthrough)
  const mapped = classified.filter((c) => c.materialKey != null);
  const unmapped = classified.filter((c) => c.materialKey == null);

  // merge mapped: key = (discipline, section, materialKey, role) — role discriminate
  interface Bucket {
    discipline: Discipline;
    section: string;
    materialKey: string;
    role: Role;
    name: string; // ชื่อ display ใช้ name ของ source แรก
    unit: string;
    qtySum: number;
    weightedPriceSum: number;
    priceQtySum: number; // หาร weighted average
    sourceItemIds: string[];
    /** ราคาที่เคยเจอ (>0) — เช็คว่าทุก source มีราคาเท่ากัน ถ้าไม่เท่า → PRICE_INCONSISTENT */
    seenPrices: Set<number>;
  }

  const buckets = new Map<string, Bucket>();
  for (const c of mapped) {
    const role: Role = c.item.isMaterial ? 'material' : 'labor';
    const key = `${c.discipline}|${c.section}|${c.materialKey}|${role}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        discipline: c.discipline,
        section: c.section,
        materialKey: c.materialKey as string,
        role,
        name: c.item.name,
        unit: c.item.unit,
        qtySum: 0,
        weightedPriceSum: 0,
        priceQtySum: 0,
        sourceItemIds: [],
        seenPrices: new Set<number>(),
      };
      buckets.set(key, b);
    }
    b.qtySum += c.item.quantity;
    if (c.item.unitPrice > 0) {
      b.weightedPriceSum += c.item.quantity * c.item.unitPrice;
      b.priceQtySum += c.item.quantity;
      b.seenPrices.add(c.item.unitPrice);
    }
    b.sourceItemIds.push(c.item.id);
  }

  // PRICE_INCONSISTENT: source unitPrice ต่างกันใน bucket เดียว (exact compare — tolerance 0)
  for (const b of buckets.values()) {
    if (b.seenPrices.size > 1) {
      const prices = Array.from(b.seenPrices).sort((a, b) => a - b);
      warnings.push(
        `PRICE_INCONSISTENT: "${b.name}" (${b.materialKey}/${b.role}) — ราคา/หน่วยต่างกัน [${prices.join(', ')}] · ใช้ weighted average`,
      );
    }
  }

  // build rows: apply allowance + ceil
  // เก็บ 2 ฐาน:
  //   *After  → ใช้ derive qtyFinal ของ consumable/labor (รวมเผื่อ)
  //   *Net    → ใช้ baseline เทียบ CONSUMABLE_DRIFT (qty ก่อนเผื่อ — เทียบกับ BOQ rate)
  let rebarMaterialKgAfter = 0;
  let rebarMaterialKgNet = 0;
  let formworkPanelM2After = 0;
  let formworkPanelM2Net = 0;

  const drafts: RowDraft[] = [];
  for (const b of buckets.values()) {
    const policy = getPolicy(b.materialKey);
    const qtyNet = b.qtySum;
    // consumables: เก็บ draft ก่อน ค่า qty/amount จะถูก override ในขั้น re-derive
    const qtyAfterAllowance = policy.derived
      ? qtyNet // placeholder — จะถูก override
      : qtyNet * (1 + policy.pct / 100);
    const qtyFinal = policy.derived ? qtyNet : ceil2dp(qtyAfterAllowance);
    const unitPrice =
      b.priceQtySum > 0 ? b.weightedPriceSum / b.priceQtySum : 0;
    drafts.push({
      section: b.section,
      materialKey: b.materialKey,
      name: b.name,
      unit: b.unit,
      qtyNet,
      allowance:
        policy.pct > 0 ? { pct: policy.pct, ref: policy.ref } : undefined,
      qtyAfterAllowance,
      qtyFinal,
      role: b.role,
      unitPrice,
      amount: qtyFinal * unitPrice,
      sourceItemIds: b.sourceItemIds,
    });

    // accumulate totals สำหรับ re-derive consumables (เฉพาะ material — เก็บทั้ง net และ after)
    // เหล็กที่เข้าฐาน Σ = key ที่ size อยู่ใน REBAR จริงเท่านั้น (RB6..DB28)
    // → ตัด rebar:labor (ไม่ใช่วัสดุ) และ rebar:mesh (ตะแกรงสำเร็จ ไม่ใช้ลวดผูก) ออก
    if (b.role === 'material') {
      if (b.materialKey.startsWith('rebar:')) {
        const size = b.materialKey.slice('rebar:'.length);
        if (size in REBAR) {
          rebarMaterialKgAfter += qtyAfterAllowance;
          rebarMaterialKgNet += qtyNet;
        }
      } else if (b.materialKey === 'formwork:panel') {
        formworkPanelM2After += qtyAfterAllowance;
        formworkPanelM2Net += qtyNet;
      }
    }
  }

  // re-derive consumables + rebar labor (แทนค่า ไม่บวก)
  // CONSUMABLE_DRIFT เทียบ baseline จาก NET (qty BOQ คิดจาก net ทั้งคู่ → เทียบสมเหตุสมผล)
  //   qtyFinal ยังใช้ "หลังเผื่อ" ตามเดิม (ของจริงสั่งซื้อ)
  const TIEWIRE_KEY = 'consumable:tiewire';
  const NAILS_KEY = 'consumable:nails';
  const REBAR_LABOR_KEY = 'rebar:labor';
  let sawTiewire = false;
  let sawNails = false;
  for (const row of drafts) {
    if (row.materialKey === TIEWIRE_KEY) {
      sawTiewire = true;
      const derivedAfter = (rebarMaterialKgAfter / 1000) * TIE_WIRE_KG_PER_TON;
      const derivedFromNet = (rebarMaterialKgNet / 1000) * TIE_WIRE_KG_PER_TON;
      const oldFinal = row.qtyNet;
      if (oldFinal > 0) {
        const drift = Math.abs(derivedFromNet - oldFinal) / oldFinal;
        if (drift > 0.05) {
          warnings.push(
            `CONSUMABLE_DRIFT: ลวดผูกเหล็ก BOQ=${oldFinal} กก. vs derivedFromNet=${derivedFromNet.toFixed(2)} กก. (ต่าง ${(drift * 100).toFixed(1)}%) — ตรวจอัตราส่วน CONSUMABLE_RATIOS.tieWirePct vs TIE_WIRE_KG_PER_TON หรือเหล็กรวม`,
          );
        }
      }
      row.qtyAfterAllowance = derivedAfter;
      row.qtyFinal = ceil2dp(derivedAfter);
      row.amount = row.qtyFinal * row.unitPrice;
    } else if (row.materialKey === NAILS_KEY) {
      sawNails = true;
      const derivedAfter = formworkPanelM2After * FORMWORK.nailKgPerSqm;
      const derivedFromNet = formworkPanelM2Net * FORMWORK.nailKgPerSqm;
      const oldFinal = row.qtyNet;
      if (oldFinal > 0) {
        const drift = Math.abs(derivedFromNet - oldFinal) / oldFinal;
        if (drift > 0.05) {
          warnings.push(
            `CONSUMABLE_DRIFT: ตะปู BOQ=${oldFinal} กก. vs derivedFromNet=${derivedFromNet.toFixed(2)} กก. (ต่าง ${(drift * 100).toFixed(1)}%) — ตรวจอัตราส่วน CONSUMABLE_RATIOS.nailsPerM2 vs FORMWORK.nailKgPerSqm หรือไม้แบบรวม`,
          );
        }
      }
      row.qtyAfterAllowance = derivedAfter;
      row.qtyFinal = ceil2dp(derivedAfter);
      row.amount = row.qtyFinal * row.unitPrice;
    } else if (row.materialKey === REBAR_LABOR_KEY) {
      // labor ผูก/ตัด/ดัดเหล็ก: qty = เหล็กวัสดุรวม (รวมเผื่อ) — ฐานเดียวกับ tiewire
      const derived = rebarMaterialKgAfter;
      row.qtyAfterAllowance = derived;
      row.qtyFinal = ceil2dp(derived);
      row.amount = row.qtyFinal * row.unitPrice;
    }
  }

  // CONSUMABLE_MISSING: มีฐานวัสดุแต่ BOQ ขาเข้าไม่มีแถว consumable → por4 ไม่ fabricate (ปรัชญา re-derive แทนค่า) จึงเตือนให้เพิ่มแถวใน BOQ
  if (rebarMaterialKgAfter > 0 && !sawTiewire) {
    warnings.push(
      `CONSUMABLE_MISSING: ไม่พบแถว "ลวดผูกเหล็ก" ใน BOQ ขาเข้า ทั้งที่มีเหล็กเสริม ${rebarMaterialKgAfter.toFixed(2)} กก. (หลังเผื่อ) — por4 ไม่สร้างแถวให้เอง เพิ่มแถวลวดผูกใน BOQ แล้วระบบจะ re-derive ปริมาณให้ (${TIE_WIRE_KG_PER_TON} กก./ตัน)`,
    );
  }
  if (formworkPanelM2After > 0 && !sawNails) {
    warnings.push(
      `CONSUMABLE_MISSING: ไม่พบแถว "ตะปู" ใน BOQ ขาเข้า ทั้งที่มีไม้แบบ ${formworkPanelM2After.toFixed(2)} ตร.ม. (หลังเผื่อ) — por4 ไม่สร้างแถวให้เอง เพิ่มแถวตะปูใน BOQ แล้วระบบจะ re-derive ปริมาณให้ (${FORMWORK.nailKgPerSqm} กก./ตร.ม.)`,
    );
  }

  // unmapped passthrough (draft)
  const unmappedDrafts: RowDraft[] = unmapped.map((c) => {
    const role: Role = c.item.isMaterial ? 'material' : 'labor';
    const qty = c.item.quantity;
    const qtyFinal = ceil2dp(qty);
    return {
      section: c.section,
      materialKey: undefined,
      name: c.item.name,
      unit: c.item.unit,
      qtyNet: qty,
      qtyAfterAllowance: qty,
      qtyFinal,
      role,
      unitPrice: c.item.unitPrice,
      amount: qtyFinal * c.item.unitPrice,
      sourceItemIds: [c.item.id],
      flags: ['UNMAPPED'],
    };
  });

  const allDrafts = [...drafts, ...unmappedDrafts];

  // ── step: distribute rebar:labor → ลง rebar:{size} material rows · ลบแถวรวม
  distributeRebarLabor(allDrafts, options, warnings);

  // ── step: drafts → Por4Row (dual-column) แล้ว pair material+labor ที่ qty ตรงกัน
  const singleRows = allDrafts.map(draftToRow);
  const rows = combineDualColumn(singleRows);
  const directCost = rows.reduce((s, r) => s + r.totalAmount, 0);
  return { rows, directCost, warnings };
}

// ═══════════════════════════════════════════════════════════════════════
// helpers: rebar:labor distribute · draft → Por4Row · pair dual-column
// ═══════════════════════════════════════════════════════════════════════

/**
 * ฝัง rebar:labor (ค่าผูก/ตัด/ดัดเหล็ก) ลงในแต่ละ rebar:{size} material แล้วลบแถวรวม
 *
 * Rate ต่อขนาด (ข1): override → ว.809 (laborPresetForRebar) — บาท/ตัน → /1000 = บ./กก.
 * Drift check: ถ้า BOQ มี unitPrice > 0 และต่างจาก weighted-avg ที่ใช้จริง > 5% → warning
 * Audit (ข2): append rebarLabor.sourceItemIds เข้า sourceItemIds ของทุก rebar:{size} ที่รับ
 */
function distributeRebarLabor(
  drafts: RowDraft[],
  options: ConsolidatePor4Options,
  warnings: string[],
): void {
  const rebarLaborIdx = drafts.findIndex(
    (d) => d.materialKey === 'rebar:labor',
  );
  if (rebarLaborIdx < 0) return;
  const rebarLabor = drafts[rebarLaborIdx]!;
  const boqRatePerKg = rebarLabor.unitPrice; // BOQ-supplied (ใช้แค่ drift check)

  // ── หา target rebar:{size} material drafts + คำนวณ rate per size
  type Target = { draft: RowDraft; size: string; ratePerKg: number };
  const targets: Target[] = [];
  let weightedLaborSum = 0;
  let weightedQtySum = 0;

  for (const d of drafts) {
    if (d === rebarLabor) continue;
    if (d.role !== 'material') continue;
    if (!d.materialKey || !d.materialKey.startsWith('rebar:')) continue;
    const size = d.materialKey.slice('rebar:'.length);
    if (!(size in REBAR)) continue; // ยกเว้น rebar:mesh / rebar:labor

    const overrideTon = options.laborRateBySizeTon?.[size];
    let ratePerTon: number | undefined;
    if (overrideTon != null) {
      ratePerTon = overrideTon;
    } else {
      const preset = laborPresetForRebar(size);
      ratePerTon = preset?.rate;
    }
    if (ratePerTon == null) {
      warnings.push(
        `REBAR_LABOR_RATE_MISSING: ${size} — ไม่พบ rate ใน ว.809 และไม่มี override → ไม่ฝัง labor ลง size นี้`,
      );
      continue;
    }

    const ratePerKg = ratePerTon / 1000;
    targets.push({ draft: d, size, ratePerKg });
    weightedLaborSum += d.qtyFinal * ratePerKg;
    weightedQtySum += d.qtyFinal;
  }

  // ── drift check (เฉพาะเมื่อ BOQ มี rate ขาเข้า)
  if (boqRatePerKg > 0 && weightedQtySum > 0) {
    const weightedAvg = weightedLaborSum / weightedQtySum;
    const drift = Math.abs(weightedAvg - boqRatePerKg) / boqRatePerKg;
    if (drift > 0.05) {
      warnings.push(
        `REBAR_LABOR_RATE_DRIFT: BOQ=${boqRatePerKg.toFixed(2)} บ./กก. vs ว.809 ถ่วงน้ำหนัก=${weightedAvg.toFixed(2)} บ./กก. (ต่าง ${(drift * 100).toFixed(1)}%)`,
      );
    }
  }

  // ── apply labor + append sourceItemIds (audit trail ข2)
  for (const t of targets) {
    t.draft.laborSidecar = { unitPrice: t.ratePerKg };
    t.draft.sourceItemIds = [
      ...t.draft.sourceItemIds,
      ...rebarLabor.sourceItemIds,
    ];
  }

  drafts.splice(rebarLaborIdx, 1);
}

function draftToRow(d: RowDraft): Por4Row {
  if (d.role === 'material') {
    const materialAmount = d.amount;
    const laborUnitPrice = d.laborSidecar?.unitPrice;
    const laborAmount =
      laborUnitPrice != null ? d.qtyFinal * laborUnitPrice : undefined;
    return {
      section: d.section,
      materialKey: d.materialKey,
      name: d.name,
      unit: d.unit,
      qtyNet: d.qtyNet,
      allowance: d.allowance,
      qtyAfterAllowance: d.qtyAfterAllowance,
      qtyFinal: d.qtyFinal,
      materialUnitPrice: d.unitPrice,
      materialAmount,
      laborUnitPrice,
      laborAmount,
      totalAmount: materialAmount + (laborAmount ?? 0),
      sourceItemIds: d.sourceItemIds,
      flags: d.flags,
    };
  }
  // labor-only draft
  return {
    section: d.section,
    materialKey: d.materialKey,
    name: d.name,
    unit: d.unit,
    qtyNet: d.qtyNet,
    allowance: d.allowance,
    qtyAfterAllowance: d.qtyAfterAllowance,
    qtyFinal: d.qtyFinal,
    laborUnitPrice: d.unitPrice,
    laborAmount: d.amount,
    totalAmount: d.amount,
    sourceItemIds: d.sourceItemIds,
    flags: d.flags,
  };
}

/**
 * รวม material-only + labor-only เป็นแถวเดียวเมื่อ:
 *   (section, materialKey, unit, qtyFinal) ตรงกัน
 * ถ้า qtyFinal ต่างกัน → คงเป็น 2 แถวแยก
 */
function combineDualColumn(rows: Por4Row[]): Por4Row[] {
  const used = new Set<number>();
  const result: Por4Row[] = [];
  const isMaterialOnly = (r: Por4Row): boolean =>
    r.materialUnitPrice != null && r.laborUnitPrice == null;
  const isLaborOnly = (r: Por4Row): boolean =>
    r.laborUnitPrice != null && r.materialUnitPrice == null;

  for (let i = 0; i < rows.length; i++) {
    if (used.has(i)) continue;
    const a = rows[i]!;
    // UNMAPPED ไม่ pair (ขาด materialKey หรือ semantic ต่างกัน)
    if (a.materialKey == null) {
      result.push(a);
      used.add(i);
      continue;
    }
    let merged: Por4Row | null = null;
    for (let j = i + 1; j < rows.length; j++) {
      if (used.has(j)) continue;
      const b = rows[j]!;
      if (b.materialKey == null) continue;
      if (
        a.section !== b.section ||
        a.materialKey !== b.materialKey ||
        a.unit !== b.unit ||
        a.qtyFinal !== b.qtyFinal
      ) {
        continue;
      }
      if (isMaterialOnly(a) && isLaborOnly(b)) {
        merged = {
          ...a,
          laborUnitPrice: b.laborUnitPrice,
          laborAmount: b.laborAmount,
          totalAmount: (a.materialAmount ?? 0) + (b.laborAmount ?? 0),
          sourceItemIds: [...a.sourceItemIds, ...b.sourceItemIds],
        };
        used.add(j);
        break;
      }
      if (isLaborOnly(a) && isMaterialOnly(b)) {
        merged = {
          ...b,
          laborUnitPrice: a.laborUnitPrice,
          laborAmount: a.laborAmount,
          totalAmount: (b.materialAmount ?? 0) + (a.laborAmount ?? 0),
          sourceItemIds: [...b.sourceItemIds, ...a.sourceItemIds],
        };
        used.add(j);
        break;
      }
    }
    result.push(merged ?? a);
    used.add(i);
  }
  return result;
}
