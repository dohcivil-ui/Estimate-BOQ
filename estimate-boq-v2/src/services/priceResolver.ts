/**
 * priceResolver — เติมราคา (วัสดุ/ค่าแรง) ให้ BOQ items แบบ deterministic
 * ───────────────────────────────────────────────────────────────────────
 * หลักการ:
 *   - วัสดุ → ตาราง material_prices รายจังหวัด (admin) · match unit + name
 *   - ค่าแรง → ว.809 (LABOR_PRESETS_W809) · match unit + name
 *   - เติมเฉพาะ unitPrice === 0 (ไม่ทับค่าที่คนแก้ — "คน ตรวจ → โค้ด ล็อก")
 *   - ต้อง match ตรง 1 ตัวถึงเติม · 0 = PRICE_MISSING · >1 = PRICE_AMBIGUOUS (ไม่เดา)
 *   - ค่าแรงหน่วยที่ ว.809 ไม่คิดที่ชั้น BOQ (เช่น เหล็ก "กก." — por.4 เติมต่อขนาดเอง)
 *     = ข้ามเงียบ ไม่ false-alarm
 * pure module: ไม่มี dependency กับ store/supabase/react
 */
import type { BOQItem } from '@/types/boq';
import type { AdminMaterialPrice } from './adminApi';
import type { LaborPreset } from '@/core/wage809';

/** substring match สองทาง (single source — SyncPricesModal จะ import ตัวนี้) */
export function itemNameMatch(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

export interface PriceUpdate {
  id: string;
  unitPrice: number;
}

export interface ResolveSources {
  materialPrices: AdminMaterialPrice[];
  laborPresets: LaborPreset[];
}

export interface ResolveResult {
  updates: PriceUpdate[];
  warnings: string[];
  filled: number;
}

export function resolvePrices(items: BOQItem[], src: ResolveSources): ResolveResult {
  const updates: PriceUpdate[] = [];
  const warnings: string[] = [];

  for (const it of items) {
    if (it.unitPrice !== 0) continue; // ไม่ทับค่าที่คนแก้

    if (it.isMaterial) {
      const cands = src.materialPrices.filter(
        (p) => p.unit === it.unit && itemNameMatch(p.item, it.name),
      );
      if (cands.length === 1) {
        updates.push({ id: it.id, unitPrice: cands[0]!.price });
      } else if (cands.length === 0) {
        warnings.push(`PRICE_MISSING (วัสดุ): "${it.name}" (${it.unit}) — ไม่พบราคาจังหวัด`);
      } else {
        warnings.push(
          `PRICE_AMBIGUOUS (วัสดุ): "${it.name}" (${it.unit}) match ${cands.length} รายการ — เลือกเอง: ${cands.map((c) => c.item).join(' / ')}`,
        );
      }
      continue;
    }

    // ── ค่าแรง → ว.809 ──
    // หน่วยที่ ว.809 ไม่มี preset (เช่น เหล็ก "กก.") = por.4 เติมเอง → ข้ามเงียบ
    const unitPriceable = src.laborPresets.some((p) => p.unit === it.unit);
    if (!unitPriceable) continue;

    const cands = src.laborPresets.filter(
      (p) => p.unit === it.unit && itemNameMatch(p.name, it.name),
    );
    if (cands.length === 1) {
      updates.push({ id: it.id, unitPrice: cands[0]!.rate });
    } else if (cands.length === 0) {
      warnings.push(`PRICE_MISSING (ค่าแรง): "${it.name}" (${it.unit}) — ไม่พบ preset ว.809 ที่ตรง`);
    } else {
      warnings.push(
        `PRICE_AMBIGUOUS (ค่าแรง): "${it.name}" (${it.unit}) match ${cands.length} preset — เลือกเอง: ${cands.map((c) => c.name).join(' / ')}`,
      );
    }
  }

  return { updates, warnings, filled: updates.length };
}
