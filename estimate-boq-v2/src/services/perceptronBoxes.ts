// src/services/perceptronBoxes.ts
// แปลงผลลัพธ์ box ดิบจาก Perceptron Mk1 → กล่องที่วาดบน canvas ได้
//
// Perceptron คืน annotation เป็น markup แบบนี้ (พิกัด normalize 0–1000 ต่อแกน):
//   <collection mention="F2">
//     <point_box> (248,352) (280,396) </point_box>   ← มุมบนซ้าย (x1,y1) , มุมล่างขวา (x2,y2)
//     ...
//   </collection>

export interface FootingBoxNorm {
  type: string;              // "F2" | "F1" | ...
  nx1: number; ny1: number;  // มุมบนซ้าย (0–1000)
  nx2: number; ny2: number;  // มุมล่างขวา (0–1000)
}

export interface FootingBoxPx {
  type: string;
  x: number; y: number; w: number; h: number; // pixel บนรูปจริง
}

const NORM_BASE = 1000; // ยืนยันแล้วจาก overlay test: Perceptron normalize 0–1000 ต่อแกน

const COLLECTION_RE = /<collection\s+mention="([^"]+)">([\s\S]*?)<\/collection>/g;
const POINTBOX_RE =
  /<point_box>\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*<\/point_box>/g;

/** ดึงกล่องทั้งหมด (normalized) จาก content ที่โมเดลคืนมา */
export function parsePerceptronBoxes(content: string): FootingBoxNorm[] {
  const boxes: FootingBoxNorm[] = [];
  let c: RegExpExecArray | null;
  COLLECTION_RE.lastIndex = 0;
  while ((c = COLLECTION_RE.exec(content)) !== null) {
    const type = c[1].trim();
    const body = c[2];
    let p: RegExpExecArray | null;
    POINTBOX_RE.lastIndex = 0;
    while ((p = POINTBOX_RE.exec(body)) !== null) {
      boxes.push({ type, nx1: +p[1], ny1: +p[2], nx2: +p[3], ny2: +p[4] });
    }
  }
  return boxes;
}

/** แปลง normalized → pixel ของรูปจริง (imgW × imgH px) */
export function toPixels(b: FootingBoxNorm, imgW: number, imgH: number): FootingBoxPx {
  return {
    type: b.type,
    x: (b.nx1 / NORM_BASE) * imgW,
    y: (b.ny1 / NORM_BASE) * imgH,
    w: ((b.nx2 - b.nx1) / NORM_BASE) * imgW,
    h: ((b.ny2 - b.ny1) / NORM_BASE) * imgH,
  };
}

/** อ่านบรรทัดสรุป เช่น "F2=12 | F1=2 | รวม=14" ไว้ cross-check กับจำนวนกล่องที่ parse ได้ */
export function parseSummary(content: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /([A-Za-zก-๙]+)\s*=\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) out[m[1]] = +m[2];
  return out;
}
