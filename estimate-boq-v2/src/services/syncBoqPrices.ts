/**
 * syncBoqPrices — auto เติมราคา BOQ จากราคาจังหวัด + baseline สพฐ. + ว.809 (deterministic)
 * เรียกหลัง import ทุกทาง (importItemsToBoq, CreateFromMeasurements)
 *  - fetch material_prices(province) → merge baseline สพฐ. (province ชนะ) → resolvePrices (fill-zero only)
 *  - apply ผ่าน store.update · เก็บ warning ลง store.priceSyncWarnings (โชว์ banner C2b)
 *  - debounce 50ms กัน burst (import วนหลาย item)
 * IO อยู่ที่นี่ (ไม่ผูก store เข้า supabase — กัน import cycle)
 */
import { useBOQStore } from '@/stores/boqStore';
import { useProjectMeta } from '@/stores/projectMetaStore';
import { listMaterialPrices } from '@/services/adminApi';
import { LABOR_PRESETS_W809 } from '@/core/wage809';
import { resolvePrices, itemNameMatch } from '@/services/priceResolver';
import { MATERIAL_BASELINE } from '@/data/defaultPrices';

export async function syncBoqPrices(): Promise<{ filled: number; warnings: string[] }> {
  const store = useBOQStore.getState();
  const province = useProjectMeta.getState().province?.trim() ?? '';
  const items = store.getAllItems();
  const warnings: string[] = [];

  let materialPrices: Awaited<ReturnType<typeof listMaterialPrices>> = [];
  if (!province) {
    warnings.push(
      'PRICE_PROVINCE_UNSET: ยังไม่ได้ตั้งจังหวัดโครงการ — ราคาวัสดุไม่ถูกเติม (แท็บ BOQ → ข้อมูลโครงการ → จังหวัด)',
    );
  } else {
    try {
      materialPrices = await listMaterialPrices(province);
      if (materialPrices.length === 0) {
        warnings.push(`PRICE_TABLE_EMPTY: ไม่มีราคาวัสดุของจังหวัด "${province}" ในระบบ (admin ยังไม่บันทึก) — ใช้ baseline สพฐ. แทน`);
      }
    } catch (e) {
      warnings.push(`PRICE_FETCH_FAILED: ดึงราคาจังหวัดไม่สำเร็จ — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // merge baseline สพฐ. เข้ากับราคาจังหวัด — province ชนะ baseline (กันชื่อจังหวัดยาว match ซ้ำ)
  // Phase B: TPSO เติม material_prices(จังหวัด) → ทับ baseline อัตโนมัติผ่าน filter นี้
  const mergedMaterial = [
    ...materialPrices,
    ...MATERIAL_BASELINE.filter(
      (b) => !materialPrices.some((p) => p.unit === b.unit && itemNameMatch(p.item, b.item)),
    ),
  ];

  const res = resolvePrices(items, { materialPrices: mergedMaterial, laborPresets: LABOR_PRESETS_W809 });
  warnings.push(...res.warnings);

  for (const u of res.updates) store.update(u.id, { unitPrice: u.unitPrice });
  store.setPriceSyncWarnings(warnings);
  if (warnings.length) console.warn('[syncBoqPrices]', warnings); // interim visibility จน banner C2b

  return { filled: res.filled, warnings };
}

let pending: ReturnType<typeof setTimeout> | null = null;
/** debounced — เรียกจากจุด import (กัน burst หลาย addItemsToPage) */
export function scheduleSyncBoqPrices(): void {
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    void syncBoqPrices();
  }, 50);
}
