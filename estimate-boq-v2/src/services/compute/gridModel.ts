// gridModel.ts — เครื่องนับฐานแบบ grid-first (กฎ 11): นับจุดตัด แล้วบวกฐานพิเศษ ไม่เคยลบ
// pure logic ล้วน · ไม่ import โมดูลอื่น · ไม่แตะค่าคงที่ถัง B

/** ฐานพิเศษนอกจุดตัด grid — บวกเข้าเสมอ ห้ามหักออกจากจุดตัด */
export interface GridExtra {
  mark: string;   // เช่น "F1"
  count: number;  // >= 0
  note?: string;  // เช่น "กึ่งกลางแนว A-B"
}

/** เปลี่ยนชนิดฐานเฉพาะจุดตัด (ค่าเริ่มต้นทุกจุด = intersectionMark) */
export interface GridOverride {
  position: string; // เช่น "3A"
  mark: string;     // เช่น "F3"
}

/** นิยาม grid — คน/AI กรอก แล้วโค้ดนับให้แบบทำซ้ำได้ */
export interface GridDef {
  longAxis: string[];         // แกนยาว เช่น ["1","2","3","4","5","6"]  (N เส้น)
  shortAxis: string[];        // แกนสั้น เช่น ["A","B"]                 (M เส้น)
  intersectionMark: string;   // ชนิดฐานที่ทุกจุดตัด เช่น "F2"
  overrides?: GridOverride[]; // เปลี่ยนชนิดเฉพาะจุด (ถ้ามี)
  extras?: GridExtra[];       // ฐานนอกจุดตัด (บวก ไม่ลบ)
}

export interface GridEnumResult {
  positions: string[];          // จุดตัดทั้งหมด เช่น ["1A","2A",...,"6B"]
  byMark: Map<string, number>;  // จำนวนแยกชนิด (จุดตัด + extras)
  intersectionTotal: number;    // = longAxis.length * shortAxis.length
  extraTotal: number;           // = ผลรวม extras.count
  total: number;                // = intersectionTotal + extraTotal
}

/**
 * นับฐานแบบ grid-first (กฎ 11):
 *  1) จุดตัด = longAxis × shortAxis (ทุกจุดมีฐานหลัก)
 *  2) จำแนกชนิด: ค่าเริ่มต้น intersectionMark, override เฉพาะจุดถ้ามี
 *  3) ฐานพิเศษนอกจุดตัด (extras) บวกเข้า — ห้ามหักจากจุดตัด
 * โยน error ถ้านิยามไม่สมเหตุผล (กันนับผิดแบบเงียบ ๆ)
 */
export function enumerateGrid(def: GridDef): GridEnumResult {
  if (def.longAxis.length === 0 || def.shortAxis.length === 0) {
    throw new Error('enumerateGrid: longAxis/shortAxis ต้องมีอย่างน้อย 1 เส้น');
  }
  const positions: string[] = [];
  for (const s of def.shortAxis) {
    for (const l of def.longAxis) {
      positions.push(`${l}${s}`);
    }
  }
  const markAt = new Map<string, string>();
  for (const p of positions) markAt.set(p, def.intersectionMark);
  for (const ov of def.overrides ?? []) {
    if (!markAt.has(ov.position)) {
      throw new Error(`enumerateGrid: override ตำแหน่ง "${ov.position}" ไม่อยู่ในจุดตัด`);
    }
    markAt.set(ov.position, ov.mark);
  }
  const byMark = new Map<string, number>();
  for (const m of markAt.values()) byMark.set(m, (byMark.get(m) ?? 0) + 1);

  const intersectionTotal = positions.length;

  let extraTotal = 0;
  for (const ex of def.extras ?? []) {
    if (ex.count < 0) {
      throw new Error(`enumerateGrid: extras "${ex.mark}" count ติดลบไม่ได้ (กฎ: บวกเท่านั้น)`);
    }
    byMark.set(ex.mark, (byMark.get(ex.mark) ?? 0) + ex.count);
    extraTotal += ex.count;
  }

  return { positions, byMark, intersectionTotal, extraTotal, total: intersectionTotal + extraTotal };
}
