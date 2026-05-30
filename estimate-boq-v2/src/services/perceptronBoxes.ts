// src/services/perceptronBoxes.ts
// ───────────────────────────────────────────────────────────────────────
// Parser สำหรับ Perceptron Mk1 annotation (annotation_format:"box")
// รองรับ 2 รูปแบบที่โมเดลคืน:
//   (A) inline label : F2, C2 (A, 1) <point_box> (247,350) (280,396) </point_box>
//                      F1, C3        <point_box> (660,502) (688,532) </point_box>
//   (B) collection   : <collection mention="F2"> <point_box> (x1,y1)(x2,y2) </point_box> … </collection>
// พิกัด normalized 0–1000 ต่อแกน, ลำดับ (x,y)  →  map เป็น px ด้วย imgW/imgH
// ───────────────────────────────────────────────────────────────────────

export const NORM_BASE = 1000;

export interface FootingBoxNorm {
  type: string;
  nx1: number;
  ny1: number;
  nx2: number;
  ny2: number;
}

export interface FootingBoxPx {
  type: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// ── ดึงชนิดฐานจาก label: "F2, C2 (A, 1)" → "F2" | "F1, C3" → "F1" ──
function typeFromLabel(label: string): string {
  const m = label.match(/[A-Za-z]{1,3}\d+/); // token แรกแบบ F2 / C3 / GB1
  return m ? m[0].toUpperCase() : '?';
}

// Tokenizer: เดินผ่าน content ตามลำดับ จับ 3 อย่าง
//   (1) <collection mention="TYPE">  → group 1 = TYPE
//   (2) </collection>
//   (3) <label?> <point_box> (x1,y1) (x2,y2) </point_box>  → group 2 = label, 3–6 = พิกัด
// แยก alt ด้วย group index ที่ติด: group1 → open, group3 → point_box, ที่เหลือ → close
function tokenRegex(): RegExp {
  return /<collection\s+mention=["']([^"']+)["']\s*>|<\/collection>|([^\n<>]*?)<point_box>\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*<\/point_box>/gi;
}

export function parsePerceptronBoxes(content: string): FootingBoxNorm[] {
  const boxes: FootingBoxNorm[] = [];
  const re = tokenRegex();
  let collectionType: string | null = null; // type จาก <collection> ที่กำลังเปิดอยู่
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m[1] !== undefined) {
      // (1) เปิด collection → ทุกกล่องข้างในใช้ type นี้
      collectionType = m[1].trim().toUpperCase();
    } else if (m[3] !== undefined) {
      // (3) point_box: ใน collection → ใช้ mention; นอก collection → inline label
      const inlineType = typeFromLabel((m[2] ?? '').trim());
      boxes.push({
        type: collectionType ?? inlineType,
        nx1: Number(m[3]),
        ny1: Number(m[4]),
        nx2: Number(m[5]),
        ny2: Number(m[6]),
      });
    } else {
      // (2) ปิด collection
      collectionType = null;
    }
  }
  return boxes;
}

export function toPixels(
  b: FootingBoxNorm,
  imgW: number,
  imgH: number,
): FootingBoxPx {
  return {
    type: b.type,
    x1: (b.nx1 / NORM_BASE) * imgW,
    y1: (b.ny1 / NORM_BASE) * imgH,
    x2: (b.nx2 / NORM_BASE) * imgW,
    y2: (b.ny2 / NORM_BASE) * imgH,
  };
}

// สรุปบรรทัด "F2=12 | F1=2 | รวม=14" → { F2:12, F1:2, รวม:14 }
export function parseSummary(content: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /([A-Za-zก-๙]+\d*)\s*=\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

// จำนวนที่โมเดล "อ้างว่านับได้" จากบรรทัดสรุป (key รวม/total) — ไว้ cross-check กับกล่องที่ parse จริง
// คืน null ถ้าไม่มีบรรทัดสรุป
export function parseExpectedTotal(content: string): number | null {
  const sum = parseSummary(content);
  const total = sum['รวม'] ?? sum['total'] ?? sum['Total'] ?? sum['TOTAL'];
  return typeof total === 'number' ? total : null;
}
