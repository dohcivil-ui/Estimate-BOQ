/**
 * PURE: คำนวณ amount/totals ของ BOQ
 * ห้าม import React/Konva
 */
import type { BOQItem } from '@/types/boq';

/**
 * adjusted quantity (เผื่อเสีย):
 *   qty × (1 + waste/100)
 *
 * ถ้ามี thickness (เช่น slab area → volume) → qty × thickness × (1 + waste/100)
 */
export function adjustedQuantity(item: BOQItem): number {
  const base = item.thickness != null ? item.quantity * item.thickness : item.quantity;
  return base * (1 + (item.wastePct || 0) / 100);
}

/** amount ของ 1 row = adjustedQty × unitPrice */
export function rowAmount(item: BOQItem): number {
  return adjustedQuantity(item) * item.unitPrice;
}

/** รวม direct cost (ก่อน Factor F) */
export function directCostTotal(items: BOQItem[]): number {
  return items.reduce((sum, it) => sum + rowAmount(it), 0);
}

/** แยก subtotal: labor vs material */
export function totalsByKind(items: BOQItem[]): {
  labor: number;
  material: number;
  total: number;
} {
  let labor = 0;
  let material = 0;
  for (const it of items) {
    const a = rowAmount(it);
    if (it.isMaterial) material += a;
    else labor += a;
  }
  return { labor, material, total: labor + material };
}

/** market price = directCost × factorF */
export function marketPrice(directCost: number, factorF: number): number {
  if (!isFinite(factorF) || factorF <= 0) return directCost;
  return directCost * factorF;
}

/** format ตัวเลขเป็นข้อความไทย "1,234.56" */
export function formatCurrency(n: number, fraction = 2): string {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  });
}
