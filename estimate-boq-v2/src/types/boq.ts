/**
 * BOQ data model — sync กับ supabase/migrations boq_items table (Step 2.6)
 */

export type BOQSource = 'manual' | 'preset' | 'ai' | 'measurement';

export interface BOQItem {
  id: string;
  /** หมวด: 'งานโครงสร้าง', 'งานสถาปัตย์', ฯลฯ */
  category: string;
  /** discipline ของ group ที่ item สังกัด — stamp ตอน export (ปร.4 ใช้เป็นหัวหมวด) */
  discipline?: Discipline;
  /** ชื่อรายการ */
  name: string;
  /** หน่วย: 'ลบ.ม.', 'ตร.ม.', 'ตัน', 'จุด', ฯลฯ */
  unit: string;
  /** ปริมาณ */
  quantity: number;
  /** ราคา/หน่วย */
  unitPrice: number;
  /** material vs labor */
  isMaterial: boolean;
  /** เผื่อเสีย (%) */
  wastePct: number;
  /** ความหนา (ม.) — ใช้แปลง ตร.ม. → ลบ.ม. (เช่น slab area × thickness) */
  thickness?: number;
  /** แหล่งที่มา */
  source: BOQSource;
  /** ชี้กลับไป measurement.id / preset.id / ai_analysis.id */
  sourceRef?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** หมวดงานหลักของแบบ (discipline) */
export type Discipline =
  | 'architectural'
  | 'structural'
  | 'electrical'
  | 'sanitary'
  | 'other';

/**
 * กลุ่ม BOQ แยกตาม discipline + หน้าแบบ (pageId)
 * เป็น single source of truth ของ boqStore — AI วิเคราะห์ใหม่ = replace เฉพาะกลุ่มของหน้านั้น
 */
export interface DisciplineGroup {
  discipline: Discipline;
  /** pageId ของหน้าแบบ; 'manual' = เพิ่มเอง/preset/วัด, 'ungrouped' = ข้อมูลเก่าที่ไม่มี page */
  pageId: string;
  pageName: string;
  items: BOQItem[];
  /** วิเคราะห์/แก้ไขล่าสุดเมื่อไหร่ (ISO) */
  analyzedAt: string;
  status: 'draft' | 'confirmed';
}

export interface ProjectMeta {
  name: string;
  client: string;
  location: string;
  province: string;
  /** Factor F สำหรับคูณ Direct Cost ได้ราคากลาง */
  factorF: number;
  /** Vat % (default 7) — ใช้คำนวณราคา + vat */
  vatPct: number;
  /** เงินล่วงหน้าจ่าย % (0/5/10/15) — เลือกตาราง Factor F CGD 2567 */
  advancePct: number;
  /** เงินประกันผลงานหัก % (0/5/10) — เลือกตาราง Factor F CGD 2567 */
  retentionPct: number;
}

/** payload ที่ accept จาก AI import (ตาม HANDOFF v2) */
export interface AIImportPayload {
  project?: string;
  // ❌ ไม่รับ factorF จาก import — Factor F ต้อง auto-lookup ตาราง CGD เสมอ
  boq: Array<{
    name: string;
    unit: string;
    rate: number;
    qty: number;
    isMat: boolean;
    waste?: number;
    category?: string;
    thick?: number;
    notes?: string;
  }>;
}
