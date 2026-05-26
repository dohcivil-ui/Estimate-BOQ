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

function subMaterialToItem(
  sub: AIMaterial,
  parent: AIItem,
  sourceRef: string,
): BOQItem {
  const total = materialTotalQty(sub, parent.quantity);
  const isMaterial = sub.kind !== 'labor';
  return {
    id: uid(),
    category: parent.category || 'อื่นๆ',
    name: typeof sub.name === 'string' && sub.name ? sub.name : '(ไม่มีชื่อ)',
    unit: cleanUnit(sub.unit),
    quantity: total,
    unitPrice:
      typeof sub.unit_price === 'number' && Number.isFinite(sub.unit_price)
        ? sub.unit_price
        : 0,
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
    wastePct: preset.defaultWastePct ?? 0,
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
        item.category === 'ฐานราก' ? 'concrete-rough' : 'concrete-mix-1story';
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
    out.push({
      id: uid(),
      category: item.category || 'อื่นๆ',
      name: item.name,
      unit: item.unit || 'ชุด',
      quantity: item.quantity,
      unitPrice: item.unit_price ?? 0,
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
