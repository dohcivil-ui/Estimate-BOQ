/**
 * Canvas color palette — single source สำหรับทุก Konva layer
 * แนว doh-thai.com: primary navy #1e3a5f + accent ทอง #c9a227
 * measure ม่วง #8b5cf6, area ฟ้า #06b6d4
 */
export const CANVAS_COLORS = {
  /** ความยาว — ม่วง */
  length: '#8b5cf6',
  /** พื้นที่ — ฟ้าน้ำเงิน */
  area: '#06b6d4',
  areaFill: 'rgba(6, 182, 212, 0.12)',
  /** สเกล — ทอง accent */
  scale: '#c9a227',
  /** นับจำนวน — เขียว */
  count: '#22c55e',
  /** ที่เลือกอยู่ — ส้มสว่าง */
  selected: '#f97316',
  /** เส้น draft ขณะวาด — ทอง */
  draft: '#c9a227',
  /** ปิด polygon ได้ — เขียว */
  close: '#22c55e',
  /** node outline / ป้ายพื้นหลัง */
  outline: '#0b1220',
  /** label text ปกติ */
  label: '#e2e8f0',
  /** grid */
  grid: '#c9a227',
} as const;

/** สี draft ตาม tool */
export function draftColorFor(tool: string): string {
  if (tool === 'length') return CANVAS_COLORS.length;
  if (tool === 'area') return CANVAS_COLORS.area;
  if (tool === 'scale') return CANVAS_COLORS.scale;
  return CANVAS_COLORS.draft;
}

/** สี snap indicator ตาม type */
export const SNAP_COLORS: Record<string, string> = {
  endpoint: '#22c55e',
  midpoint: '#eab308',
  intersection: '#ec4899',
  perpendicular: '#06b6d4',
  onEdge: '#f97316',
  grid: '#c9a227',
  image: '#22d3ee',
};
