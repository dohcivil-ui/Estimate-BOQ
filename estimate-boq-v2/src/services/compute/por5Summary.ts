/**
 * por5Summary.ts — ชั้น ปร.5 (สรุปราคากลาง)
 * --------------------------------------------------------------------------
 * จาก Direct Cost × Factor F → ราคาก่อสร้าง (เต็มบาท + เงินประมาณปัดพัน + ตัวอักษรไทย)
 *
 * อ้างอิงรูปแบบ: ปร.5 กรมโยธาธิการ ฉบับ 2544
 *   ตัวอย่าง: docs/knowledge/pr4-example-municipal-building.md
 *
 * iron rule (สำคัญ): por5Summary "ไม่" lookup Factor F เอง
 *   - caller ต้อง resolve F ผ่าน effectiveFactorF() (core/boqCalc) เสมอ
 *   - กัน double-source — F ใช้สูตรเดียวทั่วทั้งระบบ
 *   - VAT ฝังใน Factor F แล้ว (ตาราง CGD 2567) → ไม่มีบรรทัด VAT แยกในปร.5
 *     ดู govExcelExport.ts (sheet "ปร.5" / "Factor F") เพื่อ cross-check
 *
 * pure module: ไม่ import store/supabase/react
 */

export interface Por5Config {
  /** ปัด constructionCost → จำนวนเต็มบาท: 'floor' (default ตาม ปร.5) | 'round' */
  bahtMode?: 'floor' | 'round';
  /** หน่วยปัดเงินประมาณ (default 1000 = ปัดหลักพัน ตามแบบกรมโยธาฯ) */
  approxStep?: number;
  /** วิธีปัดเงินประมาณ: 'floor' (default — "ปัดเศษทิ้ง") | 'round' */
  approxMode?: 'floor' | 'round';
}

export interface Por5Result {
  /** Direct Cost ดิบ (full precision — เก็บไว้ audit) */
  directCost: number;
  /** Factor F ที่ caller resolve มา */
  factorF: number;
  /** ราคาก่อสร้าง = directCost × factorF (full precision — เก็บไว้ audit) */
  constructionCost: number;
  /** ราคาก่อสร้างเต็มบาท (ปัดตาม bahtMode) — ตัวเลขในช่อง "ค่าก่อสร้าง" ของ ปร.5 */
  constructionCostBaht: number;
  /** เงินประมาณ — ปัดหลักพันทิ้งจาก constructionCostBaht */
  approxAmount: number;
  /** เงินประมาณตัวอักษรไทย — ลงท้าย "บาทถ้วน" */
  approxAmountText: string;
}

// ─────────────────────────────────────────────────────────────────────
// guards: epsilon ก่อนปัด กัน float error (5931154×1.2628 = 7489861.2712 — safe)
//   แต่บางคูณอาจได้ x.999999… ใกล้ขอบ → floor ตัดทิ้งผิด 1 บาท
// ─────────────────────────────────────────────────────────────────────
const EPS = 1e-9;
const floorBaht = (x: number): number => Math.floor(x + EPS);
const roundBaht = (x: number): number => Math.round(x);

/**
 * คำนวณ ปร.5
 * @param directCost  ส่วนที่ 1 ค่าก่อสร้าง × Factor F
 * @param factorF     Factor F ที่ caller resolve มา (effectiveFactorF เสมอ)
 * @param specialCost ส่วนที่ 2 ค่าใช้จ่ายพิเศษ (default 0) — ไม่คูณ F
 *                    อ้างเอกสารหลักเกณฑ์ "ส่วนที่ 3 การสรุปค่าก่อสร้างทั้งหมด":
 *                    constructionCost = (ส่วนที่ 1 × F) + ส่วนที่ 2
 *                    ส่วนที่ 2 รวมเข้าหลังคูณ F แล้ว (ไม่อยู่ในฐาน F lookup)
 */
export function por5Summary(
  directCost: number,
  factorF: number,
  specialCost: number = 0,
  config: Por5Config = {},
): Por5Result {
  const bahtMode = config.bahtMode ?? 'floor';
  const approxStep = config.approxStep ?? 1000;
  const approxMode = config.approxMode ?? 'floor';

  const constructionCost = directCost * factorF + specialCost;
  const constructionCostBaht =
    bahtMode === 'round'
      ? roundBaht(constructionCost)
      : floorBaht(constructionCost);
  const approxAmount =
    approxMode === 'round'
      ? Math.round(constructionCostBaht / approxStep) * approxStep
      : Math.floor(constructionCostBaht / approxStep + EPS) * approxStep;
  const approxAmountText = bahtText(approxAmount);
  return {
    directCost,
    factorF,
    constructionCost,
    constructionCostBaht,
    approxAmount,
    approxAmountText,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// bahtText — แปลงจำนวนเต็มบาท → ตัวอักษรไทย ลงท้าย 'บาทถ้วน'
// กฎภาษาไทย:
//   - หลักหน่วยตัวสุดท้ายของกลุ่ม: 1 = 'เอ็ด' (เฉพาะเมื่อมีหลักนำหน้า) · 1 เดี่ยว = 'หนึ่ง'
//   - หลักสิบ: 1 = 'สิบ' (ไม่ใช่ 'หนึ่งสิบ') · 2 = 'ยี่สิบ' (ไม่ใช่ 'สองสิบ')
//   - หลักล้านซ้อน: 10ล้าน = 'สิบล้าน', 100ล้าน = 'หนึ่งร้อยล้าน', 1ล้านล้าน = 'หนึ่งล้านล้าน'
// ═══════════════════════════════════════════════════════════════════════
const DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

/** อ่านเลข 0..999,999 — hasUpperGroup=true ถ้ามีกลุ่ม "ล้าน" นำหน้า (สำหรับกฎ "เอ็ด") */
function readSix(n: number, hasUpperGroup: boolean): string {
  if (n === 0) return '';
  const str = String(n).padStart(6, '0');
  let s = '';
  for (let i = 0; i < 6; i++) {
    const d = Number(str[i]);
    const placeIdx = 5 - i; // 5=แสน, 4=หมื่น, 3=พัน, 2=ร้อย, 1=สิบ, 0=หน่วย
    if (d === 0) continue;
    if (placeIdx === 1) {
      // หลักสิบ
      if (d === 1) s += 'สิบ';
      else if (d === 2) s += 'ยี่สิบ';
      else s += DIGITS[d] + 'สิบ';
    } else if (placeIdx === 0) {
      // หลักหน่วย: 1 → 'เอ็ด' ถ้ามีหลักนำ (ในกลุ่มเดียว หรือมีกลุ่มบนล้าน)
      const hasLeading = s.length > 0 || hasUpperGroup;
      if (d === 1 && hasLeading) s += 'เอ็ด';
      else s += DIGITS[d];
    } else {
      s += DIGITS[d] + PLACES[placeIdx];
    }
  }
  return s;
}

/** อ่านเลข ≥0 รวมหลักล้านซ้อน (recursive) */
function readNumber(n: number): string {
  if (n < 1_000_000) return readSix(n, false);
  const upper = Math.floor(n / 1_000_000);
  const lower = n % 1_000_000;
  let s = readNumber(upper) + 'ล้าน';
  if (lower > 0) s += readSix(lower, true);
  return s;
}

export function bahtText(n: number): string {
  // จำนวนเต็มบาทเสมอ — guard ตัวลบ/NaN
  if (!isFinite(n) || n < 0) return 'ศูนย์บาทถ้วน';
  const int = Math.floor(n + EPS);
  if (int === 0) return 'ศูนย์บาทถ้วน';
  return readNumber(int) + 'บาทถ้วน';
}
