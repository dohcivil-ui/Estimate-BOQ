/**
 * Import AI result → BOQ
 *
 *  - แปลง AIAnalysisResponse → BOQItem[] ผ่าน itemToBOQItems()
 *  - Append เข้า group ของหน้านั้นด้วย addItemsToPage() (ไม่ replace)
 *  - คืน array ของ boq row id ที่สร้าง — caller ใช้ mark message ว่า imported แล้ว
 */
import type {
  AIAnalysisResponse,
  AIDiscipline,
  AIItem,
} from '@/types/ai';
import type { Discipline } from '@/types/boq';
import { useBOQStore } from '@/stores/boqStore';
import { itemToBOQItems } from './aiToBoq';
import { scheduleSyncBoqPrices } from './syncBoqPrices';

/** map AIDiscipline → BOQ Discipline (ตอนนี้ map 1:1 — 4 ตัวตรงกัน) */
function toBoqDiscipline(d: AIDiscipline): Discipline {
  return d;
}

export interface ImportItemsToBoqOptions {
  /** subset ของ AIItem ที่ user เลือก (preview modal) */
  items: AIItem[];
  /** discipline ของผลวิเคราะห์ — ใช้เป็น group ใน BOQ */
  discipline: AIDiscipline;
  /** id ของหน้าแบบ (drawing page) เพื่อจัดกลุ่ม BOQ */
  pageId: string;
  /** ชื่อ pageName ที่จะใส่ใน DisciplineGroup ถ้ายังไม่มี */
  pageName: string;
  /** sourceRef = อะไรก็ได้ที่ trace กลับมาที่ analysis/message ได้ */
  sourceRef: string;
}

export interface ImportResultToBoqOptions {
  result: AIAnalysisResponse;
  pageId: string;
  pageName: string;
  sourceRef: string;
}

export interface ImportResultToBoqOutcome {
  /** boq row id ที่สร้าง (append) */
  boqIds: string[];
  /** จำนวน AI item ที่ skip เพราะ map ไม่ได้ */
  skippedItems: number;
}

/**
 * Import subset ของ AIItem เข้า BOQ store (append)
 *  - ไม่กระทบ items เดิมของหน้านั้น
 *  - ถ้า items[] ว่าง → คืน boqIds=[]
 */
export function importItemsToBoq(
  opts: ImportItemsToBoqOptions,
): ImportResultToBoqOutcome {
  const discipline = toBoqDiscipline(opts.discipline);
  const created: string[] = [];
  let skipped = 0;

  for (const it of opts.items) {
    const boqRows = itemToBOQItems(it, opts.sourceRef);
    if (boqRows.length === 0) {
      skipped += 1;
      continue;
    }
    created.push(...boqRows.map((r) => r.id));
    useBOQStore
      .getState()
      .addItemsToPage(opts.pageId, discipline, opts.pageName, boqRows);
  }

  if (created.length > 0) scheduleSyncBoqPrices();
  return { boqIds: created, skippedItems: skipped };
}

/**
 * Import ทั้งผลวิเคราะห์เข้า BOQ store (append) — เรียกใช้ importItemsToBoq ภายใน
 *  (เก็บไว้เผื่อ caller ที่ยังเรียก API เก่า)
 */
export function importResultToBoq(
  opts: ImportResultToBoqOptions,
): ImportResultToBoqOutcome {
  return importItemsToBoq({
    items: opts.result.items ?? [],
    discipline: opts.result.discipline,
    pageId: opts.pageId,
    pageName: opts.pageName,
    sourceRef: opts.sourceRef,
  });
}
