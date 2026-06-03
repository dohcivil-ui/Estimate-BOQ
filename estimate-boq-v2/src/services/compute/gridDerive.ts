/**
 * gridDerive — แปลงเส้น grid ที่ผู้ใช้วาด (GridLine[]) → label arrays สำหรับ GridDef
 * pure: ไม่อ่าน store · ไม่คำนวณปริมาณวิศวกรรม · แค่จำแนก/เรียง/ตั้งชื่อแกน
 * ใช้เติมฟอร์ม GridDialog อัตโนมัติ (คนตรวจ/แก้ก่อน Save → setGrid)
 */
import type { GridLine } from '@/types/tool';

export interface DerivedAxes {
  longAxis: string[];   // แกนตั้ง (numbered 1..N) เรียงซ้าย→ขวา
  shortAxis: string[];  // แกนนอน (lettered A..M) เรียงบน→ล่าง
}

/** letterLabel — index 0-based → ป้ายตัวอักษรสไตล์คอลัมน์ Excel (0→A, 25→Z, 26→AA) */
function letterLabel(i: number): string {
  let n = i;        // ตัวเลขทำงาน 0-based
  let s = '';       // สะสมตัวอักษร
  do {
    s = String.fromCharCode(65 + (n % 26)) + s; // เติมหลักขวาสุด
    n = Math.floor(n / 26) - 1;                 // ถอยหลักถัดไป (A=0 ไม่มีหลัก 0)
  } while (n >= 0);
  return s;
}

/**
 * deriveAxesFromLines — จำแนกตั้ง/นอนด้วยแกนเด่น แล้วตั้งชื่อแกน
 * ตั้ง: |dy|>=|dx| → x กลาง → longAxis (1..N) · นอน: |dx|>|dy| → y กลาง → shortAxis (A..M)
 * หมายเหตุ: 1 เส้น = 1 แกน (ยังไม่ dedupe เส้นซ้อน — DC)
 */
export function deriveAxesFromLines(lines: GridLine[]): DerivedAxes {
  const vertical: number[] = [];    // x กลางของเส้นตั้ง
  const horizontal: number[] = [];  // y กลางของเส้นนอน
  for (const ln of lines) {
    const dx = ln.b.x - ln.a.x;     // กว้างแกน x
    const dy = ln.b.y - ln.a.y;     // สูงแกน y
    if (Math.abs(dy) >= Math.abs(dx)) {
      vertical.push((ln.a.x + ln.b.x) / 2);   // เส้นตั้ง → เก็บ x กลาง
    } else {
      horizontal.push((ln.a.y + ln.b.y) / 2); // เส้นนอน → เก็บ y กลาง
    }
  }
  vertical.sort((p, q) => p - q);    // ซ้าย→ขวา
  horizontal.sort((p, q) => p - q);  // บน→ล่าง (y น้อย=บน)
  const longAxis: string[] = [];     // ป้ายแกนตั้ง
  for (let i = 0; i < vertical.length; i++) longAxis.push(String(i + 1));     // 1..N
  const shortAxis: string[] = [];    // ป้ายแกนนอน
  for (let i = 0; i < horizontal.length; i++) shortAxis.push(letterLabel(i)); // A..M
  return { longAxis, shortAxis };
}
