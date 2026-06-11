/**
 * por6Summary.ts — ชั้น ปร.6 (สรุปรวมราคากลาง)
 * --------------------------------------------------------------------------
 * รวมยอดเงินประมาณของแต่ละส่วน (ปร.5 ของอาคาร/ระบบ/อื่นๆ) → ยอดรวมโครงการ
 *
 * อ้างอิงรูปแบบ: ปร.6 กรมโยธาธิการ ฉบับ 2544
 *   ตัวอย่าง: docs/knowledge/pr4-example-municipal-building.md
 *
 * iron rule:
 *   - แต่ละ part.netAmount ปัดมาแล้ว (จาก por5Summary.approxAmount) → ห้ามปัดซ้ำ
 *   - total = Σ netAmount ตรงๆ (ผลรวมเป็นจำนวนเต็ม เพราะแต่ละส่วนเป็นจำนวนเต็ม)
 *   - bahtText ใช้ตัวเดียวกับ por5Summary (re-export)
 *
 * pure module: ไม่ import store/supabase/react
 */
import { bahtText } from './por5Summary';

export interface Por6Part {
  /** ชื่อส่วน เช่น "ค่าก่อสร้างอาคาร", "ครุภัณฑ์จัดซื้อ" */
  label: string;
  /** ยอดสุทธิของส่วนนั้น — ปัดมาแล้วจาก por5Summary.approxAmount */
  netAmount: number;
}

export interface Por6Result {
  /** ยอดรวมโครงการ = Σ parts.netAmount (ไม่ปัดซ้ำ) */
  total: number;
  /** ยอดรวมตัวอักษรไทย — ลงท้าย "บาทถ้วน" */
  totalText: string;
}

export function por6Summary(parts: Por6Part[]): Por6Result {
  const total = parts.reduce((sum, p) => sum + p.netAmount, 0);
  return {
    total,
    totalText: bahtText(total),
  };
}
