// gridReconcile.ts — ตัวเทียบจำนวนฐาน (B-2): เทียบ "ที่โค้ดนับได้ (grid-first)" กับ "ที่คนแท็กจริง"
// pure logic ล้วน · ไม่ import โมดูลอื่น · ไม่แตะค่าคงที่ถัง B
// ใช้ผลต่างเพื่อ "ติดธงให้คนตรวจ" เท่านั้น — ไม่แก้ตัวเลข ไม่ตัดสินแทนคน

/** ผลเทียบต่อ mark หนึ่ง ๆ */
export interface MarkDiff {
  mark: string;
  enumerated: number; // โค้ดนับได้ (grid-first) — 0 ถ้าไม่มี mark นี้
  tagged: number;     // คนแท็กได้ — 0 ถ้าไม่ได้แท็ก
  diff: number;       // tagged - enumerated (บวก = แท็กเกิน, ลบ = แท็กขาด)
  ok: boolean;        // อยู่ในเกณฑ์ที่ยอมต่างได้
}

export interface ReconcileResult {
  ok: boolean;            // true = ทุก mark ตรงในเกณฑ์
  diffs: MarkDiff[];      // ราย mark (รวม key สองฝั่ง เรียงตามชื่อ)
  flaggedMarks: string[]; // mark ที่ต่างเกินเกณฑ์ (ต้องให้คนตรวจ)
}

export interface ReconcileOptions {
  /** จำนวนที่ยอมให้ต่างได้ (default 0 = ต้องตรงเป๊ะ เพราะเป็นการนับ) */
  tolerance?: number;
}

/**
 * เทียบจำนวนฐาน grid-first (โค้ด) กับจำนวนที่คนแท็ก:
 *  - รวมรายชื่อ mark จากทั้งสองฝั่ง (ฝั่งไหนไม่มี = 0)
 *  - diff = tagged - enumerated · ok เมื่อ |diff| <= tolerance
 *  - ไม่แก้ตัวเลข — แค่รายงานผลต่างไว้ติดธงให้คนตรวจ
 */
export function reconcileGridCount(
  enumerated: Map<string, number>,
  tagged: Map<string, number>,
  opts: ReconcileOptions = {},
): ReconcileResult {
  const tol = opts.tolerance ?? 0;
  if (tol < 0) throw new Error('reconcileGridCount: tolerance ติดลบไม่ได้');

  const marks = Array.from(new Set([...enumerated.keys(), ...tagged.keys()])).sort();
  const diffs: MarkDiff[] = marks.map((mark) => {
    const e = enumerated.get(mark) ?? 0;
    const t = tagged.get(mark) ?? 0;
    const diff = t - e;
    return { mark, enumerated: e, tagged: t, diff, ok: Math.abs(diff) <= tol };
  });
  const flaggedMarks = diffs.filter((d) => !d.ok).map((d) => d.mark);
  return { ok: flaggedMarks.length === 0, diffs, flaggedMarks };
}
