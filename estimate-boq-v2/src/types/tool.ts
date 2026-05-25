/** เครื่องมือใน Step 2.3 */
export type Tool =
  | 'select'   // เลือกแก้ไข
  | 'pan'      // ลากเลื่อนภาพ
  | 'scale'    // ตั้งสเกล (คลิก 2 จุด)
  | 'length'   // วัดความยาว (polyline)
  | 'area'     // วัดพื้นที่ (polygon)
  | 'count';   // นับจำนวน (marker)

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
};

export const TOOL_HOTKEYS: Record<Tool, string> = {
  select: 'V',
  pan: 'H',
  scale: 'K',
  length: 'L',
  area: 'A',
  count: 'C',
};
