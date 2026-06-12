/**
 * แปลง AIItem → BOQItem[]
 *
 * Priority:
 *   1. materials / sub_items / accessories ใดมี → 1 BOQ row ต่อ entry
 *      ใช้ total_qty ถ้ามี ไม่งั้นใช้ qty (ถือเป็น total)
 *   2. structural fallback: concrete_m3/formwork_m2/rebar_kg + preset ว.809
 *   3. labor (ถ้าระบุ) → เพิ่ม 1 row "ค่าแรง: ..." rate × quantity
 *   4. generic: 1 row จาก quantity + unit + unit_price (electrical/sanitary primary)
 */
import type { AIItem, AIMaterial, AILabor } from '@/types/ai';
import type { BOQItem } from '@/types/boq';
import {
  LABOR_PRESETS_W809,
  laborPresetForRebar,
  type LaborPreset,
} from '@/core/wage809';

const now = (): string => new Date().toISOString();
const uid = (): string => crypto.randomUUID();

function presetById(id: string): LaborPreset | null {
  return LABOR_PRESETS_W809.find((p) => p.id === id) ?? null;
}

/** ดึงค่าจริงต่อ row: ใช้ total_qty ถ้ามี ไม่งั้น qty (กัน unit undefined) */
function materialTotalQty(sub: AIMaterial, parentQty: number): number {
  if (typeof sub.total_qty === 'number' && sub.total_qty > 0) {
    return sub.total_qty;
  }
  const qty = typeof sub.qty === 'number' && Number.isFinite(sub.qty) ? sub.qty : 0;
  const unit = typeof sub.unit === 'string' ? sub.unit : '';
  if (unit.includes('/')) {
    // unit เช่น "ลบ.ม./ฐาน" = per-piece → คูณด้วย parentQty
    return qty * (parentQty || 1);
  }
  return qty;
}

/** ตัด suffix "/<หน่วยหลัก>" ออกจาก unit เพื่อให้เหลือ unit จริง (กัน undefined) */
function cleanUnit(unit: string | undefined | null): string {
  if (typeof unit !== 'string' || !unit) return 'หน่วย';
  return unit.split('/')[0]!.trim() || 'หน่วย';
}

/**
 * แก้ bug ราคาเหล็กบาน 1000 เท่า — เกิดเมื่อ AI ส่ง unit="กก." แต่ unit_price
 * เป็นค่าจากตาราง "บาท/ตัน" (เช่น 21,050) แทนที่จะเป็น "บาท/กก." (21.05).
 *
 * Heuristic (ต้องเข้าทั้ง 3 เงื่อนไข):
 *  1. unit normalize เป็น "กก." / "kg" / "kilogram"
 *  2. unitPrice > 200 (ราคาเหล็กจริง ~20-25 บ./กก. — ถ้า > 200 น่าจะเป็น บ./ตัน)
 *  3. name หรือ category match รูปแบบเหล็กเสริม (SR/SD/RB/DB/เหล็ก)
 *
 * idempotent: เรียกซ้ำกับค่าเดิม (เช่น 21.05) → return ค่าเดิม (ไม่หารอีก)
 *
 * ตัวอย่าง:
 *   fixRebarUnitPrice("SR.24 RB9", "เหล็กเสริม", "กก.", 21050) → 21.05
 *   fixRebarUnitPrice("เหล็ก DB12", "ฐานราก",    "กก.", 21150) → 21.15
 *   fixRebarUnitPrice("ลวดผูกเหล็ก",  "ฐานราก",  "กก.", 58)    → 58 (ไม่แตะ < 200)
 *   fixRebarUnitPrice("คอนกรีต 240",  "ฐานราก",  "ลบ.ม.", 2470) → 2470 (unit ≠ กก.)
 *   fixRebarUnitPrice("SR.24 RB9",   "เหล็กเสริม", "กก.", 21.05) → 21.05 (idempotent)
 */
export function fixRebarUnitPrice(
  name: string,
  category: string,
  unit: string,
  unitPrice: number,
): number {
  if (!Number.isFinite(unitPrice) || unitPrice <= 200) return unitPrice;
  const normUnit = unit.toLowerCase().replace(/[.\s]/g, '');
  if (normUnit !== 'กก' && normUnit !== 'kg' && normUnit !== 'kilogram') {
    return unitPrice;
  }
  const haystack = `${name} ${category}`;
  // SR24 / SD40 / SD50 / RB6-25 / DB10-32 หรือคำว่า "เหล็ก" (เหล็กเสริม/เหล็กข้ออ้อย ฯลฯ)
  const steelPattern =
    /(SR\.?\s?24|SD\.?\s?(?:40|50)|\bRB\s?\d+|\bDB\s?\d+|เหล็กเสริม|เหล็กข้ออ้อย|เหล็กกลม)/i;
  if (!steelPattern.test(haystack)) return unitPrice;
  const fixed = unitPrice / 1000;
  console.warn(
    `[ai-to-boq] 🔧 ราคาเหล็ก "${name}" ${unitPrice} บ./ตัน → ${fixed} บ./กก. (หน่วย ${unit})`,
  );
  return fixed;
}

function subMaterialToItem(
  sub: AIMaterial,
  parent: AIItem,
  sourceRef: string,
): BOQItem {
  const total = materialTotalQty(sub, parent.quantity);
  const isMaterial = sub.kind !== 'labor';
  const name = typeof sub.name === 'string' && sub.name ? sub.name : '(ไม่มีชื่อ)';
  const unit = cleanUnit(sub.unit);
  const rawPrice =
    typeof sub.unit_price === 'number' && Number.isFinite(sub.unit_price)
      ? sub.unit_price
      : 0;
  const unitPrice = fixRebarUnitPrice(name, parent.category || '', unit, rawPrice);
  return {
    id: uid(),
    category: parent.category || 'อื่นๆ',
    name,
    unit,
    quantity: total,
    unitPrice,
    isMaterial,
    wastePct: 0, // sub ที่ AI ส่ง มักจะรวมเผื่อแล้ว
    thickness: undefined,
    source: 'ai',
    sourceRef,
    notes: [parent.name, sub.note].filter(Boolean).join(' — ') || undefined,
    createdAt: now(),
    updatedAt: now(),
  };
}

function laborToItem(
  labor: AILabor,
  parent: AIItem,
  sourceRef: string,
): BOQItem {
  return {
    id: uid(),
    category: parent.category || 'อื่นๆ',
    name: labor.description || `ค่าแรง ${parent.name}`,
    unit: cleanUnit(labor.unit || parent.unit),
    quantity: parent.quantity,
    unitPrice: labor.rate ?? 0,
    isMaterial: false,
    wastePct: 0,
    thickness: undefined,
    source: 'ai',
    sourceRef,
    notes: [parent.name, labor.ref].filter(Boolean).join(' — ') || undefined,
    createdAt: now(),
    updatedAt: now(),
  };
}

function buildPresetItem(
  preset: LaborPreset,
  quantity: number,
  sourceRef: string,
  noteSuffix?: string,
): BOQItem {
  return {
    id: uid(),
    category: preset.category,
    name: preset.name,
    unit: preset.unit,
    quantity,
    unitPrice: preset.rate,
    isMaterial: false,
    wastePct: 0, // BOQ = net · เผื่อคิดที่ ปร.4 (r19)
    thickness: undefined,
    source: 'ai',
    sourceRef,
    notes: noteSuffix,
    createdAt: now(),
    updatedAt: now(),
  };
}

/** main entry — แปลง 1 item → BOQItem[] (กัน input ที่ field ผิด schema) */
export function itemToBOQItems(item: AIItem, sourceRef: string): BOQItem[] {
  const out: BOQItem[] = [];
  if (!item || typeof item !== 'object') return out;

  // ─── Path 1: arrays ของ breakdown ──────────────────────────────────
  const breakdowns: AIMaterial[] = [];
  if (Array.isArray(item.materials)) breakdowns.push(...item.materials);
  if (Array.isArray(item.sub_items)) breakdowns.push(...item.sub_items);
  if (Array.isArray(item.accessories)) breakdowns.push(...item.accessories);

  for (const sub of breakdowns) {
    if (!sub || typeof sub !== 'object') continue;
    if (!isFiniteNumber(sub.qty) && !isFiniteNumber(sub.total_qty)) continue;
    out.push(subMaterialToItem(sub, item, sourceRef));
  }

  // ─── Path 2: structural fallback (legacy schema) ────────────────────
  if (out.length === 0) {
    const qty = item.quantity || 1;
    const noteBase = `${item.name}${item.dimensions ? ` (${item.dimensions})` : ''}`;

    if (item.concrete_m3 != null && item.concrete_m3 > 0) {
      const presetId =
        item.category === 'ฐานราก' ? 'concrete-rough' : 'concrete-pour-1story';
      const preset = presetById(presetId);
      if (preset)
        out.push(
          buildPresetItem(
            preset,
            item.concrete_m3 * qty,
            sourceRef,
            `คอนกรีต ${noteBase} × ${qty}`,
          ),
        );
    }
    if (item.formwork_m2 != null && item.formwork_m2 > 0) {
      const preset = presetById('formwork');
      if (preset)
        out.push(
          buildPresetItem(
            preset,
            item.formwork_m2 * qty,
            sourceRef,
            `ไม้แบบ ${noteBase} × ${qty}`,
          ),
        );
    }
    if (item.rebar_kg != null && item.rebar_kg > 0) {
      const tonnes = (item.rebar_kg * qty) / 1000;
      const preset = pickRebarPresetByDiameter(item.rebar);
      if (preset)
        out.push(
          buildPresetItem(
            preset,
            tonnes,
            sourceRef,
            `เหล็กเสริม ${noteBase} (${item.rebar ?? '—'}) × ${qty}`,
          ),
        );
    }
  }

  // ─── Path 3: labor (เพิ่มเข้าไป เสมอถ้ามี — เพราะ structural breakdown ไม่มี labor) ──
  if (
    item.labor &&
    isFiniteNumber(item.labor.rate) &&
    item.labor.rate > 0 &&
    out.length > 0
  ) {
    // มี labor + มี materials/sub_items แล้ว → เพิ่ม labor row
    out.push(laborToItem(item.labor, item, sourceRef));
  }

  // ─── Path 4: generic — electrical/sanitary มี unit_price ที่ item level ──
  if (out.length === 0 && isFiniteNumber(item.quantity) && item.quantity > 0) {
    const unit = item.unit || 'ชุด';
    const rawPrice = item.unit_price ?? 0;
    const unitPrice = fixRebarUnitPrice(
      item.name,
      item.category || '',
      unit,
      rawPrice,
    );
    out.push({
      id: uid(),
      category: item.category || 'อื่นๆ',
      name: item.name,
      unit,
      quantity: item.quantity,
      unitPrice,
      isMaterial: true,
      wastePct: 0,
      thickness: undefined,
      source: 'ai',
      sourceRef,
      notes:
        [item.description, item.dimensions, item.notes]
          .filter(Boolean)
          .join(' — ') || undefined,
      createdAt: now(),
      updatedAt: now(),
    });
    // ถ้ามี labor ด้วย เพิ่มอีก row
    if (
      item.labor &&
      isFiniteNumber(item.labor.rate) &&
      item.labor.rate > 0
    ) {
      out.push(laborToItem(item.labor, item, sourceRef));
    }
  }

  return out;
}

function pickRebarPresetByDiameter(rebar?: string): LaborPreset | null {
  if (!rebar) return presetById('rebar-medium');
  const matches = Array.from(rebar.matchAll(/(?:RB|DB)\s*(\d+)/gi));
  if (matches.length === 0) return presetById('rebar-medium');
  let maxD = 0;
  for (const m of matches) {
    const d = parseInt(m[1]!, 10);
    if (d > maxD) maxD = d;
  }
  return laborPresetForRebar(`DB${maxD}`);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v);
}

/** alias เก่า สำหรับ component ที่ import ตามชื่อเดิม */
export const elementToBOQItems = itemToBOQItems;

/**
 * Migration: scan BOQ rows ที่ import ไปแล้วก่อน fix นี้ + แก้ราคาเหล็กที่บาน 1000 เท่า
 *
 *  - heuristic ตัวเดียวกับ fixRebarUnitPrice (idempotent)
 *  - คืน list ใหม่ + จำนวน row ที่แก้
 *  - ไม่แตะ row ที่ราคาถูกแล้ว
 */
export function repairRebarPricingInItems(items: BOQItem[]): {
  items: BOQItem[];
  fixed: number;
} {
  let fixed = 0;
  const next = items.map((it) => {
    const corrected = fixRebarUnitPrice(it.name, it.category, it.unit, it.unitPrice);
    if (corrected === it.unitPrice) return it;
    fixed += 1;
    return { ...it, unitPrice: corrected, updatedAt: now() };
  });
  return { items: next, fixed };
}
