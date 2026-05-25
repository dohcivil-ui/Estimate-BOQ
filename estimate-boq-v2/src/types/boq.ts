/**
 * BOQ data model — sync กับ supabase/migrations boq_items table (Step 2.6)
 */

export type BOQSource = 'manual' | 'preset' | 'ai' | 'measurement';

export interface BOQItem {
  id: string;
  /** หมวด: 'งานโครงสร้าง', 'งานสถาปัตย์', ฯลฯ */
  category: string;
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

export interface ProjectMeta {
  name: string;
  client: string;
  location: string;
  province: string;
  /** Factor F สำหรับคูณ Direct Cost ได้ราคากลาง */
  factorF: number;
  /** Vat % (default 7) — ใช้คำนวณราคา + vat */
  vatPct: number;
}

/** payload ที่ accept จาก AI import (ตาม HANDOFF v2) */
export interface AIImportPayload {
  project?: string;
  factorF?: number;
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
