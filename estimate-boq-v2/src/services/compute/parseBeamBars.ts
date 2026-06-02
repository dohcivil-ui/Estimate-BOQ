// src/services/compute/parseBeamBars.ts
// P3-2: parser เหล็กคานหลัก — จับ "ทุกกลุ่ม" n-DBx (บน/ล่าง/เสริมพิเศษ) ไม่ใช่แค่กลุ่มแรก
//
// ทำไมแยกโมดูล: parseVBars (boqAdapter.ts) ใช้ร่วมกับ "เหล็กยืนตอม่อ" (:190,:342)
// ซึ่งคาดหวัง return เดี่ยว {size,count} — ห้ามเปลี่ยนเป็น multi-match ไม่งั้นพังเหล็กฐาน/เสา
// ตัวนี้จึงเป็น parser แยก ใช้เฉพาะเหล็กคานหลัก (boqAdapter.ts:381)
//
// return เป็น {size,count}[] ซึ่ง assignable เข้า BeamBar[] ที่ call site
// (BeamBar รับ object ที่มีแค่ {size,count} ได้ — ดู wrap เดิม buildBOQ/boqAdapter)
//
// หมายเหตุ scope: ทุกกลุ่มถูกคิด "เต็มความยาวคาน" (lengthFactor 1.0)
// การแยกเหล็กเสริมพิเศษให้คิด L/4 ยัง DEFER — ต้องเพิ่ม field/convention ใน input model
// (detectionStore + MarkDims + AI prompt + adapter) เป็นงานคนละก้อน (ดู docs/cgd-constants.md)

export function parseBeamBars(text: string | undefined): { size: string; count: number }[] {
  if (!text) return [];
  const out: { size: string; count: number }[] = [];
  for (const m of text.matchAll(/(\d+)\s*[-xX×]?\s*(DB|RB)\s?(\d+)/gi)) {
    out.push({ size: `${m[2]!.toUpperCase()}${m[3]}`, count: parseInt(m[1]!, 10) });
  }
  return out;
}
