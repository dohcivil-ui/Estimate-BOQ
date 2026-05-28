import type { AIEngine } from '@/services/aiEngines';

/**
 * AI analysis types — 4 disciplines + 'auto' detect + rich item schema
 *
 * Schema สอดคล้องกับ spec ของผู้ใช้:
 *   - items[] (ไม่ใช่ elements[])
 *   - แต่ละ item มี: category, name, description, quantity, unit, source, confidence,
 *     และ array ของ materials/sub_items/accessories (ขึ้นกับ discipline)
 *   - building_info ที่ระดับ response
 */

/** discipline ของแบบ */
export type AIDiscipline =
  | 'architectural' // 🏛️ สถาปัตยกรรม
  | 'structural' // 🏗️ โครงสร้าง
  | 'electrical' // ⚡ ไฟฟ้า
  | 'sanitary'; // 🚿 สุขาภิบาล

/** alias ตามชื่อใน user spec — ใช้ได้ทั้งสองชื่อ */
export type DisciplineMode = AIDiscipline;

/** mode ที่เลือกใน UI — รวม 'auto' (ตรวจจับจาก AI ก่อน) */
export type AIMode = AIDiscipline | 'auto';

/**
 * ความมั่นใจ/ที่มาของค่าใน item
 * - high/medium/low: ระดับความมั่นใจเดิม (ยังใช้กับ auto-detect)
 * - measured: อ่านค่าจากแบบโดยตรง (กฎข้อ 10)
 * - calculated: คำนวณจากข้อมูลที่อ่านได้
 * - estimated: ประมาณจากหลักวิศวกรรม
 */
export type AIConfidence =
  | 'high'
  | 'medium'
  | 'low'
  | 'measured'
  | 'calculated'
  | 'estimated';

/** ที่มาของตัวเลข */
export type AIDataSource =
  | 'อ่านจากแบบ'
  | 'คำนวณ'
  | 'ประมาณ'
  | 'นับจากแบบ'
  | string;

export const DISCIPLINE_LABELS: Record<AIDiscipline, string> = {
  architectural: '🏛️ สถาปัตยกรรม',
  structural: '🏗️ โครงสร้าง',
  electrical: '⚡ ไฟฟ้า',
  sanitary: '🚿 สุขาภิบาล',
};

/** ข้อมูลอาคารหลัก (top-level metadata) */
export interface AIBuildingInfo {
  name?: string;
  dimensions?: string;
  floor_area?: number;
  stories?: number;
}

/** วัสดุประกอบ — รองรับทั้ง materials/sub_items/accessories */
export interface AIMaterial {
  name: string;
  /** ปริมาณ (ต่อชิ้น หรือ total ถ้าไม่มี total_qty) */
  qty: number;
  unit: string;
  /** ปริมาณรวม (ใน structural แสดง qty=per-piece + total_qty=grand total) */
  total_qty?: number;
  unit_price?: number;
  note?: string;
  /** วัสดุ vs ค่าแรง — default 'material' */
  kind?: 'material' | 'labor';
}

/** ค่าแรงต่อ item (architectural/structural/electrical) */
export interface AILabor {
  description: string;
  rate: number;
  unit: string;
  ref?: string;
}

/** type ของ item — string-loose (discipline-specific naming) */
export type AIItemCategory = string;

/** 1 item ในผลวิเคราะห์ */
export interface AIItem {
  /** category ของ item เช่น "งานพื้น", "ฐานราก", "ดวงโคม", "ท่อประปา" */
  category: AIItemCategory;
  /** ชื่อ/รหัส เช่น "F1 ฐานรากเดี่ยว 1.50×1.50×0.30" */
  name: string;
  description?: string;
  /** จำนวนหลักของ item — ใช้ tier นี้สำหรับ BOQ row (พื้นที่ ตร.ม. / จำนวนชิ้น) */
  quantity: number;
  unit: string;
  /** ที่มาของตัวเลข */
  source?: AIDataSource;
  /** ความมั่นใจในการอ่าน */
  confidence?: AIConfidence;

  // ─── breakdown arrays (1 ใน 3 ตาม discipline) ──────────────────────
  /** architectural ใช้ "materials" */
  materials?: AIMaterial[];
  /** structural ใช้ "sub_items" (มี total_qty per piece × quantity) */
  sub_items?: AIMaterial[];
  /** sanitary ใช้ "accessories" */
  accessories?: AIMaterial[];

  /** ค่าแรงต่อ item (architectural/structural/electrical) */
  labor?: AILabor;
  /** electrical/sanitary ใช้ unit_price ตรงๆ (ไม่มี materials array) */
  unit_price?: number;

  // ─── extra fields (สำหรับ structural backward compat + display) ────
  dimensions?: string;
  rebar?: string;
  /** structural primary fields (ถ้าใช้ schema เก่า) */
  concrete_m3?: number;
  formwork_m2?: number;
  rebar_kg?: number;

  notes?: string;
}

/** ผลวิเคราะห์เต็ม */
export interface AIAnalysisResponse {
  discipline: AIDiscipline;
  /** ประเภทแบบ เช่น "ผังพื้น", "แปลนคาน", "Single Line Diagram" */
  drawing_type?: string;
  scale?: string;
  building_info?: AIBuildingInfo;
  items: AIItem[];
  /** หมายเหตุ/ข้อควรตรวจสอบ */
  notes?: string[];
  /** สิ่งที่อ่านไม่ชัด — flag ให้ user ยืนยัน */
  unreadable?: string[];
}

/** ผลตรวจจับ discipline แบบ auto */
export interface AIDetectResult {
  detected_discipline: AIDiscipline | 'unknown';
  drawing_type?: string;
  confidence: AIConfidence;
  reason?: string;
}

export type AIAnalysisStatus = 'idle' | 'pending' | 'success' | 'error';

/** record ของ 1 analysis ใน store */
export interface AIAnalysis {
  id: string;
  pageId: string;
  /** AI engine ที่ใช้เรียกจริง */
  engine: AIEngine;
  /** mode ที่ user เลือก (อาจเป็น 'auto') */
  mode: AIMode;
  /** discipline จริงที่ใช้ — กรณี auto = ค่าที่ตรวจจับได้ */
  discipline: AIDiscipline;
  status: AIAnalysisStatus;
  raw?: string;
  result?: AIAnalysisResponse;
  /** ผลตรวจจับ (กรณี auto) */
  detected?: AIDetectResult;
  model?: string;
  hd: boolean;
  elapsedMs?: number;
  error?: string;
  tokens?: { in?: number; out?: number };
  /** ถ้า user "Import to BOQ" จากผลวิเคราะห์เริ่มต้นแล้ว → boq row ids ที่สร้าง (append-only) */
  importedBoqIds?: string[];
  importedAt?: string;
  createdAt: string;
}

export type AISuggestionStatus = 'pending' | 'accepted' | 'rejected';

export interface AISuggestion {
  id: string;
  pageId: string;
  analysisId: string;
  discipline: AIDiscipline;
  /** item ดั้งเดิม (snapshot จาก AI) */
  item: AIItem;
  /** override จาก user ก่อน accept */
  edited?: Partial<AIItem>;
  status: AISuggestionStatus;
  createdBoqIds?: string[];
}

// ═══════════════════════════════════════════════════════════════════════
// Multi-page reference + Chat
// ═══════════════════════════════════════════════════════════════════════

/** ภาพอ้างอิงที่ส่งให้ AI ก่อนภาพ target */
export interface AIReferenceImage {
  /** id ของ DrawingPage ต้นทาง */
  pageId: string;
  /** เลขหน้าใน file */
  pageNum: number;
  /** label เช่น "Arch-A1.pdf หน้า 1 — รายการวัสดุ" */
  label: string;
  /** data URL (jpeg quality 0.70, max 1000px) */
  dataUrl: string;
}

export type ChatRole = 'user' | 'assistant';

export interface AIChatMessage {
  id: string;
  role: ChatRole;
  /** ข้อความ raw (อาจเป็น JSON สำหรับ assistant) */
  content: string;
  /** ถ้า AI ตอบกลับเป็น JSON ที่ parse ได้ → ผลลัพธ์ที่ update */
  parsedResult?: AIAnalysisResponse;
  /** ถ้า user "Apply" ผลใหม่นี้แล้ว (เก่า — รักษาไว้เผื่อ backward compat) */
  applied?: boolean;
  /** ถ้า user "Import to BOQ" จาก reply นี้แล้ว → bookkeeping ของ boq row ที่สร้าง */
  imported?: { boqIds: string[]; at: string };
  createdAt: string;
}

export interface AIConversation {
  /** ผูกกับ analysis ต้นทาง (1 conversation ต่อ 1 analysis) */
  analysisId: string;
  pageId: string;
  messages: AIChatMessage[];
  /** ถ้าจำกัด context window — เก็บแค่ N turn ล่าสุด */
  truncated?: boolean;
}
