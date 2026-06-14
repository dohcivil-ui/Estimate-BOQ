// แปลงจำนวนเงินเป็นข้อความบาทไทย (deterministic, locale-independent)
// ใช้แทน Excel BAHTTEXT — เขียนเป็น string literal ลง B26 ตอน export

const DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

/** อ่านเลขกลุ่ม 1..999,999 — hasHigher = มีหลักล้านนำหน้า (สำหรับกฎ "เอ็ด") */
function readGroup(n: number, hasHigher: boolean): string {
  const s = String(n);
  const L = s.length;
  let out = '';
  for (let i = 0; i < L; i++) {
    const d = Number(s[i]);
    const place = L - 1 - i; // 0=หน่วย,1=สิบ,2=ร้อย,...
    if (d === 0) continue;
    if (place === 0) {
      out += d === 1 && (L > 1 || hasHigher) ? 'เอ็ด' : DIGITS[d];
    } else if (place === 1) {
      out += d === 1 ? 'สิบ' : d === 2 ? 'ยี่สิบ' : DIGITS[d] + 'สิบ';
    } else {
      out += DIGITS[d] + PLACES[place];
    }
  }
  return out;
}

/** อ่านจำนวนเต็มบาท — recursion รองรับ "ล้านล้าน" */
function readInteger(n: number): string {
  if (n === 0) return '';
  const million = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  let out = '';
  if (million > 0) out += readInteger(million) + 'ล้าน';
  if (rest > 0) out += readGroup(rest, million > 0);
  return out;
}

/**
 * แปลงจำนวนเงิน (บาท) เป็นข้อความบาทไทย
 * @example bahtText(13938000) // "สิบสามล้านเก้าแสนสามหมื่นแปดพันบาทถ้วน"
 */
export function bahtText(amount: number): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new Error(`bahtText: invalid amount ${amount}`);
  }
  const neg = amount < 0;
  const totalSatang = Math.round(Math.abs(amount) * 100);
  const baht = Math.floor(totalSatang / 100);
  const satang = totalSatang % 100;

  let text: string;
  if (baht === 0 && satang === 0) {
    text = 'ศูนย์บาทถ้วน';
  } else {
    text = baht > 0 ? readInteger(baht) + 'บาท' : '';
    text += satang > 0 ? readGroup(satang, false) + 'สตางค์' : 'ถ้วน';
  }
  return neg ? 'ลบ' + text : text;
}
