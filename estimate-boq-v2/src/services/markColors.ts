/**
 * markColors.ts — สีประจำ "mark" (รหัสชิ้นงาน) สำหรับไฮไลต์/ระบายบน canvas + Legend
 * --------------------------------------------------------------------------
 * - FIXED_MARK_COLOR: mark สำคัญที่ผู้ใช้คุ้น (F2/F1/GB1/GB2/C2/C3/GS) ผูกสีตายตัว
 *   → ดูแบบเดิมแล้วจำสีได้ทันที
 * - mark อื่น ๆ → จองสีจาก MARK_PALETTE แบบไม่ซ้ำ (deterministic ตามลำดับที่พบ)
 *
 * pure module: ไม่มี dependency กับ store/react/konva
 */

/** จานสี 12 สี (คุมโทนให้อ่านง่ายบนพื้นแบบขาว/เทา) */
export const MARK_PALETTE: readonly string[] = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#e11d48', // rose
];

/** สีตายตัวสำหรับ mark ที่ใช้บ่อย — เลือกจาก palette ให้แยกหมวดชัด */
const FIXED_MARK_COLOR: Record<string, string> = {
  F2: '#ef4444', // ฐานราก F2 — แดง
  F1: '#f97316', // ฐานราก F1 — ส้ม
  C2: '#3b82f6', // ตอม่อ/เสา C2 — น้ำเงิน
  C3: '#06b6d4', // ตอม่อ/เสา C3 — ฟ้า
  GB1: '#22c55e', // คาน GB1 — เขียว
  GB2: '#ec4899', // คาน GB2 — ชมพู
  GS: '#a855f7', // พื้น GS — ม่วง
};

/** สีที่ถูกจองไป (mark → color) — รวม FIXED ตั้งต้น */
const reserved: Record<string, string> = { ...FIXED_MARK_COLOR };

/** normalize mark ให้เทียบกันได้ — รหัสประกอบ "F2,C2" ใช้สีของ token แรก */
function normMark(mark: string): string {
  return mark.split(/[,\s/]+/)[0]!.trim().toUpperCase();
}

/**
 * คืนสีประจำ mark
 *  - FIXED → สีตายตัว
 *  - อื่น ๆ → จองสีถัดไปจาก palette ที่ยังไม่ถูกใช้ (ไม่ซ้ำ)
 *  - palette หมด → วน modulo (ยอมให้ซ้ำเมื่อเกิน 12 mark)
 */
export function getMarkColor(mark: string): string {
  const key = normMark(mark);
  const existing = reserved[key];
  if (existing) return existing;

  const used = new Set(Object.values(reserved));
  const free = MARK_PALETTE.find((c) => !used.has(c));
  const color = free ?? MARK_PALETTE[Object.keys(reserved).length % MARK_PALETTE.length]!;
  reserved[key] = color;
  return color;
}

/** สีตัวอักษรที่อ่านชัดบนพื้นสี hex (ขาว/ดำ ตามความสว่าง) */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // luminance (perceptual) — สว่าง → ตัวดำ, มืด → ตัวขาว
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#0b1220' : '#ffffff';
}
