/**
 * markParse — แยก/จัดหมวด "รหัส mark" (รวมรหัสประกอบ เช่น "F2,C2")
 * --------------------------------------------------------------------------
 * pure module: ไม่มี dependency กับ store/react/konva → ใช้ได้ทั้ง compute layer
 *   และ UI · 1 ป้ายบนแบบอาจมีหลายรหัส (ฐาน+เสาที่จุดกริดเดียวกัน) → เก็บเป็น
 *   "F2,C2" แล้ว split เป็น token เวลานับ/จัดหมวด
 */

export type MemberCategory = 'footing' | 'column' | 'beam' | 'slab' | 'other';

/** แยกรหัสประกอบ "F2, C2 GB1" → ['F2','C2','GB1'] (uppercase, ตัดว่าง) */
export function splitMarks(mark: string): string[] {
  return mark
    .split(/[,\s/]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length > 0);
}

/** เดาหมวดจากรหัส token เดียว (F→ฐาน, C/ตอม่อ→เสา, GB/B→คาน, GS/PS→พื้น) */
export function categoryForMark(mark: string): MemberCategory {
  const m = mark.trim().toUpperCase();
  if (/^F\d/.test(m)) return 'footing';
  if (/(^C\d|ตอม่อ|PEDESTAL)/.test(m)) return 'column';
  if (/(GB|^B\d|คาน|BEAM)/.test(m)) return 'beam';
  if (/(GS|PS|พื้น|SLAB)/.test(m)) return 'slab';
  return 'other';
}
