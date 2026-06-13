/**
 * buildExportData.ts — แปลงผล ปร.4 (เลขล็อก) → BoqExportData สำหรับ exporter ใหม่
 * ─────────────────────────────────────────────────────────────────────────
 * bridge ที่ขาดอยู่: por4.rows (section string + materialKey)  →  buildingItems[code 1–12]
 * จัดหมวดด้วย cgdSectionMap (materialKey หลัก, category=row.section fallback)
 *
 * หลักการ:
 *   - แต่ละ section: แถวแรก = 'sub' (หัวข้อย่อย 1.x) → ตรง convention master (slot แรก=sub)
 *   - item: qty=qtyFinal (เลขล็อกหลังเผื่อ/ceil), matUnit/laborUnit = ราคา/หน่วย (master คูณเอง)
 *   - UNMAPPED (จัดหมวดไม่ได้) → ไม่ส่งออก + warning (ไม่เดาหมวดเงียบ ๆ)
 *   - reconcile: Σ totalAmount ที่จัดได้ ต้อง = por4.directCost (ไม่งั้น warning)
 *
 * Factor F bracket: รับเป็น input (caller หาจากตาราง CGD ด้วย factorFBracketFor — รอ boqCalc)
 *   เพื่อให้ master interpolate ได้ค่าเดียวกับ effectiveFactorF (double-entry)
 *
 * pure module: ไม่ import store/supabase/react
 * ─────────────────────────────────────────────────────────────────────────
 */
import type { BoqExportData, SectionRow } from './govExcelExport';
import type { Por4Result, Por4Row } from '../compute/por4Consolidate';
import { cgdTargetFor } from './cgdSectionMap';
import { BUILDING } from './govExcelMap';

export interface BuildExportDataInput {
  /** ผล ปร.4 จาก buildPor456ViewModel().por4 (เลขล็อก) */
  por4: Por4Result;
  meta: BoqExportData['meta'];
  /** bracket Factor F จากตาราง CGD (advance/retention + ช่วงต้นทุน + F คู่) */
  factorF: BoqExportData['factorF'];
  /** ส่วนที่ 2 ครุภัณฑ์จัดซื้อ (v1 ส่งตรง — ยังไม่ผ่าน cgdSectionMap) */
  equipmentItems?: SectionRow[];
  conditions?: BoqExportData['conditions'];
}

export interface BuildExportDataResult {
  data: BoqExportData;
  warnings: string[];
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** แปลง Por4Row → SectionRow.item (ราคา/หน่วย ให้ master คูณ qty เอง) */
function rowToItem(r: Por4Row): SectionRow {
  return {
    type: 'item',
    name: r.name,
    qty: r.qtyFinal,
    unit: r.unit,
    matUnit: r.materialUnitPrice ?? 0,
    laborUnit: r.laborUnitPrice ?? 0,
  };
}

export function buildExportData(input: BuildExportDataInput): BuildExportDataResult {
  const warnings: string[] = [];
  const validCodes = new Set<number>(BUILDING.sections.map((s) => s.code));

  // จัดกลุ่ม: code → sub (รักษาลำดับด้วย Map) → Por4Row[]
  const byCode = new Map<number, Map<string, Por4Row[]>>();
  const unmapped: string[] = [];
  let placedTotal = 0;

  for (const row of input.por4.rows) {
    // materialKey เป็นหลัก · row.section = ผลของ sectionFromCategory(category) → ใช้เป็น category fallback
    const target = cgdTargetFor(row.materialKey, row.section);
    if (!target || !validCodes.has(target.code)) {
      unmapped.push(`${row.name}${row.materialKey ? ` [${row.materialKey}]` : ` (cat:${row.section})`}`);
      continue;
    }
    let subMap = byCode.get(target.code);
    if (!subMap) {
      subMap = new Map<string, Por4Row[]>();
      byCode.set(target.code, subMap);
    }
    const list = subMap.get(target.sub) ?? [];
    list.push(row);
    subMap.set(target.sub, list);
    placedTotal = r2(placedTotal + row.totalAmount);
  }

  if (unmapped.length > 0) {
    warnings.push(
      `UNMAPPED_CGD: ${unmapped.length} รายการจัดหมวด CGD ไม่ได้ (ไม่ถูกส่งออก) — ` +
        `${unmapped.join(', ')} · เพิ่ม materialKey/category ใน cgdSectionMap ก่อน export`,
    );
  }
  // reconcile กับเลขล็อก ปร.4 (กันรายการตกหายเงียบ ๆ)
  const directCost = r2(input.por4.directCost);
  if (Math.abs(placedTotal - directCost) > 0.01) {
    warnings.push(
      `EXPORT_RECONCILE: ผลรวมที่จัดหมวดได้ ${placedTotal.toLocaleString()} ≠ ปร.4 directCost ` +
        `${directCost.toLocaleString()} (ต่าง ${r2(placedTotal - directCost)})`,
    );
  }

  // ประกอบ buildingItems: หัวข้อย่อย (sub) ก่อน แล้วตามด้วย item
  const buildingItems: Record<number, SectionRow[]> = {};
  for (const [code, subMap] of byCode) {
    const rows: SectionRow[] = [];
    for (const [sub, list] of subMap) {
      rows.push({ type: 'sub', name: sub });
      for (const row of list) rows.push(rowToItem(row));
    }
    // เตือนล่วงหน้าถ้าเกิน slot (exporter จะ throw — ดักไว้ก่อนเป็น warning)
    const sec = BUILDING.sections.find((s) => s.code === code)!;
    const slots = sec.lastItem - sec.firstItem + 1;
    if (rows.length > slots) {
      warnings.push(
        `SLOT_OVERFLOW: หมวด ${code} ${sec.name} มี ${rows.length} แถว เกิน slot ${slots} — ขยาย master`,
      );
    }
    buildingItems[code] = rows;
  }

  const data: BoqExportData = {
    meta: input.meta,
    buildingItems,
    equipmentItems: input.equipmentItems ?? [],
    factorF: input.factorF,
    conditions: input.conditions,
  };
  return { data, warnings };
}
