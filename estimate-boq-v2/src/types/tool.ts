import type { Point2D } from '@/types/viewport';

/** เส้น grid 1 เส้น (page-px) — ปลายสองด้าน ไว้วาด overlay (inc2) + นับเป็น GridDef (inc ถัดไป) */
export interface GridLine {
  a: Point2D;
  b: Point2D;
  /** ชนิดเส้น (inc4a): 'axis' = แกนจริง (นับเป็น grid) · 'guide' = เส้นช่วย (ไม่นับ) · ไม่ระบุ = 'axis' */
  kind?: 'axis' | 'guide';
}

/** เครื่องมือใน Step 2.3 */
export type Tool =
  | 'select'   // เลือกแก้ไข
  | 'pan'      // ลากเลื่อนภาพ
  | 'scale'    // ตั้งสเกล (คลิก 2 จุด)
  | 'length'   // วัดความยาว (polyline)
  | 'area'     // วัดพื้นที่ (polygon)
  | 'count'    // นับจำนวน (marker)
  | 'paint'      // ระบายหมวดงาน (ไฮไลต์ชิ้นงาน BOQ บนแบบ)
  | 'grid'       // วาดเส้นแกน (gridline) ทาบบนแบบ แล้วนับเส้น เป็น GridDef
  | 'dimension'; // วาดเส้นบอกระยะ แล้วพิมพ์ระยะจริง (pixel เป็นแค่สายตา)

/** เครื่องมือที่ "วาด" — ต้องการ scale ตั้งก่อน */
export const DRAWING_TOOLS: ReadonlyArray<Tool> = [
  'scale',
  'length',
  'area',
  'count',
];

/** เครื่องมือที่ต้องการ scale + ใช้ draftPoints */
export const POLY_TOOLS: ReadonlyArray<Tool> = ['scale', 'length', 'area'];

export const TOOL_LABELS: Record<Tool, string> = {
  select: '🖱️ เลือก',
  pan: '✋ เลื่อน',
  scale: '📐 สเกล',
  length: '📏 ความยาว',
  area: '⬡ พื้นที่',
  count: '🔢 นับจำนวน',
  paint: '🎨 ระบายงาน',
  grid: '▦ ร่างกริด',
  dimension: '↔ ระยะจริง',
};

export const TOOL_HOTKEYS: Record<Tool, string> = {
  select: 'V',
  pan: 'H',
  scale: 'K',
  length: 'L',
  area: 'A',
  count: 'C',
  paint: 'G',
  grid: 'D',
  dimension: 'R',
};
