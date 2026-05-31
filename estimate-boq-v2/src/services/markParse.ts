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

/** หน่วยตามหมวด — F→ฐาน C→ต้น GB/B→ตัว · slab อ่านพื้นที่ ตร.ม. จากมิติในแบบ */
function unitLabelForCategory(cat: MemberCategory): string {
  switch (cat) {
    case 'footing':
      return 'ฐาน';
    case 'column':
      return 'ต้น';
    case 'beam':
      return 'ตัว';
    case 'slab':
      return 'บริเวณ (คิดพื้นที่ ตร.ม. จากมิติในแบบ)';
    default:
      return 'จุด';
  }
}

/** marker ที่นับได้ (มี geometry แล้ว) — input ขั้นต่ำสำหรับ buildTagTally */
export interface TagTallyMember {
  mark: string;
  hasGeometry: boolean;
}

/**
 * ประกอบบล็อก "จำนวนจริงจาก tag" จาก marker ที่ระบายแล้วบนหน้า (มี geometry)
 *   group ชื่อด้วย splitMarks → นับต่อ token → ติดหน่วยตามหมวด
 *   คืน '' ถ้าไม่มี marker ที่นับได้ (caller จะไม่แนบบล็อก)
 */
export function buildTagTally(members: TagTallyMember[]): string {
  const counts = new Map<string, { count: number; cat: MemberCategory }>();
  for (const m of members) {
    if (!m.hasGeometry) continue;
    for (const token of splitMarks(m.mark)) {
      const cur = counts.get(token);
      if (cur) cur.count += 1;
      else counts.set(token, { count: 1, cat: categoryForMark(token) });
    }
  }
  if (counts.size === 0) return '';
  const parts: string[] = [];
  for (const [token, { count, cat }] of counts) {
    parts.push(`${token}=${count} ${unitLabelForCategory(cat)}`);
  }
  return `จำนวนจริงจาก tag (ใช้ตามนี้ ห้ามนับใหม่): ${parts.join(', ')}`;
}
