/**
 * govExcelMap.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Single source of truth สำหรับการกรอก Template ราชการ (ปร.4 / Factor F / ปร.5 / ปร.6)
 * ลงไฟล์ boq-master.xlsx ด้วย ExcelJS
 *
 * หลักการ: exporter เขียนเฉพาะ "input cell" (กลุ่ม A) เท่านั้น
 *          formula / chain / format / print / merge / รูป ทั้งหมดอยู่ใน master แล้ว — ห้ามแตะ
 *
 * ที่มาของ mapping: derive จากการ reverse-engineer ไฟล์ต้นฉบับ Attach_BOQ_1.xlsx
 * ─────────────────────────────────────────────────────────────────────────
 */

/** ลำดับ sheet (ห้ามเปลี่ยนชื่อ — สูตร cross-sheet ผูกกับชื่อ) */
export const SHEET_ORDER = [
  'factor F',      // hidden — คำนวณ Factor F (interpolate) + 2 รูป
  '1.ปร.4',        // สรุป 4(–5) หมวด
  'ปร4.อาคาร',     // รายละเอียดงานอาคาร (input หลัก)
  'ปร4.ครุภัณฑ์',  // รายละเอียดครุภัณฑ์
  'ปร.5.อาคาร',    // สรุปค่าก่อสร้าง (ปร.5ก)
  'ปร 5.ครุภัณฑ์',  // สรุปครุภัณฑ์ (ปร.5ข)  ← มีช่องว่างในชื่อ
  'ปร.6',          // สรุปราคากลางรวม
] as const;

/**
 * META — ช่องหัวกระดาษเฉพาะโครงการ (กลุ่ม A: input)
 * exporter เขียน "label + ค่า" ทั้ง string (master เก็บ label prefix ไว้แล้ว)
 * รูปแบบ: [sheet, cell, labelPrefix]  →  เขียน `${labelPrefix}${value}`
 */
export const META_CELLS = {
  projectName: [
    ['1.ปร.4', 'A1', 'รายการประมาณการ  '],
    ['ปร4.อาคาร', 'A3', 'งานก่อสร้าง  '],
    ['ปร4.ครุภัณฑ์', 'A3', 'งานก่อสร้าง  '],
    ['ปร.5.อาคาร', 'A3', 'งานก่อสร้าง  '],
    ['ปร 5.ครุภัณฑ์', 'A3', 'งานก่อสร้าง  '],
    ['ปร.6', 'A3', 'งานก่อสร้าง  '],
  ],
  location: [
    ['1.ปร.4', 'A2', 'สถานที่ก่อสร้าง '],
    ['ปร4.อาคาร', 'A4', 'สถานที่ก่อสร้าง           '],
    ['ปร4.ครุภัณฑ์', 'A4', 'สถานที่ก่อสร้าง           '],
    ['ปร.5.อาคาร', 'A4', 'สถานที่ก่อสร้าง           '],
    ['ปร 5.ครุภัณฑ์', 'A4', 'สถานที่ก่อสร้าง           '],
    ['ปร.6', 'A4', 'สถานที่ก่อสร้าง           '],
  ],
  province: [
    ['ปร4.อาคาร', 'G4', 'จังหวัด          '],
    ['ปร4.ครุภัณฑ์', 'G4', 'จังหวัด          '],
    ['ปร.5.อาคาร', 'E4', 'จังหวัด   '],
    ['ปร 5.ครุภัณฑ์', 'H4', 'จังหวัด       '],
    ['ปร.6', 'E4', 'จังหวัด   '],
  ],
  agency: [
    ['ปร.5.อาคาร', 'B5', ' '],
    ['ปร 5.ครุภัณฑ์', 'B5', ' '],
  ],
  estimateDate: [
    ['ปร 5.ครุภัณฑ์', 'A7', 'ประมาณการราคาเมื่อวันที่  '],
  ],
  estimatedBy: [
    ['ปร.6', 'B7', ' '],
  ],
  approver: [
    ['ปร 5.ครุภัณฑ์', 'E32', ''],   // เช่น "(นายโกวิท  หมื่นทา)"
    ['ปร 5.ครุภัณฑ์', 'E33', ''],   // ตำแหน่ง
  ],
} as const;

/**
 * ปร4.อาคาร — 5 หมวด
 * คอลัมน์: C=ปริมาณ, D=หน่วย, E=ราคาวัสดุ/หน่วย, F=เงินวัสดุ(สูตร),
 *          G=ราคาแรง/หน่วย, H=เงินแรง(สูตร), I=รวม(สูตร)
 * exporter เขียนเฉพาะ C/D/E/G — F/H/I เป็นสูตรใน master (=C*E, =C*G, =F+H)
 */
export const BUILDING = {
  cols: { qty: 'C', unit: 'D', matUnit: 'E', matAmt: 'F', laborUnit: 'G', laborAmt: 'H', total: 'I' },
  /** header=แถวหัวหมวด, firstItem..lastItem=ช่วงรายการ, total=แถวรวมหมวด (SUM อยู่ใน master) */
  sections: [
    { code: 1, name: 'หมวดงานเตรียมพื้นที่และงานรื้อถอน', header: 7,   firstItem: 8,   lastItem: 18,  total: 19 },
    { code: 2, name: 'หมวดงานโครงสร้างหลังคา',          header: 20,  firstItem: 21,  lastItem: 30,  total: 31 },
    { code: 3, name: 'หมวดงานสถาปัตยกรรม',              header: 32,  firstItem: 33,  lastItem: 95,  total: 96 },
    { code: 4, name: 'หมวดงานไฟฟ้า',                    header: 97,  firstItem: 98,  lastItem: 119, total: 120 },
    { code: 5, name: 'หมวดงานสุขาภิบาล',                header: 121, firstItem: 122, lastItem: 175, total: 176 },
  ],
  grandTotalRow: 177, // F177=F19+F31+F96+F120+F176 (สูตรใน master)
} as const;

/**
 * ปร4.ครุภัณฑ์ — คอลัมน์เลื่อน 1 ช่อง
 * D=จำนวน, E=หน่วย, F=ราคาวัสดุ, G=เงินวัสดุ(สูตร), H=ราคาแรง, I=เงินแรง(สูตร), J=รวม(สูตร)
 */
export const EQUIPMENT = {
  cols: { qty: 'D', unit: 'E', matUnit: 'F', matAmt: 'G', laborUnit: 'H', laborAmt: 'I', total: 'J' },
  firstItem: 8, lastItem: 16, total: 17, // G17=SUM(G8:G16); แถว 18 mirror → J18 ส่งเข้า ปร.5(ข)
} as const;

/**
 * Factor F — input เงื่อนไข + ช่วงตารางเทียบ (กลุ่ม A)
 * ส่วน interpolate (N26) เป็นสูตร — ห้ามแตะ
 */
export const FACTOR_F = {
  // เงื่อนไข (สัดส่วน)
  advanceRate: 'factor F!E14',     // เงินล่วงหน้าจ่าย
  retentionRate: 'factor F!E15',   // เงินประกันผลงานหัก
  // ช่วงตารางเทียบ CGD — เลือกคู่ช่วงให้ครอบค่างานต้นทุนจริง (สำคัญ! ดู README)
  rangeLow: 'factor F!N18',        // B = ค่างานต้นทุนตัวต่ำ
  rangeHigh: 'factor F!N19',       // C = ค่างานต้นทุนตัวสูง
  fLow: 'factor F!N20',            // D = Factor F ของ B
  fHigh: 'factor F!N21',           // E = Factor F ของ C
} as const;

/** เงื่อนไขที่ปรากฏซ้ำใน ปร.5(ก) — ใส่ให้ตรงกับ FACTOR_F */
export const POR5_CONDITIONS = {
  advanceRate: 'ปร.5.อาคาร!C14',
  retentionRate: 'ปร.5.อาคาร!C15',
  loanInterest: 'ปร.5.อาคาร!C16',
  vat: 'ปร.5.อาคาร!C17',
} as const;

export const EQUIPMENT_VAT = 'ปร 5.ครุภัณฑ์!G10'; // ครุภัณฑ์ ×(1+VAT) ไม่ผ่าน Factor F

/**
 * CHAIN — จุดเชื่อม cross-sheet (กลุ่ม B: สูตรใน master, ห้ามเขียนทับ)
 * เก็บไว้เป็นเอกสารอ้างอิง / ใช้ตรวจสอบว่า master ยังครบ
 */
export const CHAIN_FORMULAS = {
  'factor F!N9':        "='1.ปร.4'!F18",          // ค่างานต้นทุน → Factor F
  'factor F!N26':       '=FLOOR(V26,0.0001)',     // Factor F สุดท้าย (interpolate)
  'ปร.5.อาคาร!D12':     "='1.ปร.4'!F18",          // ค่างานต้นทุน
  'ปร.5.อาคาร!E12':     "='factor F'!N26",        // Factor F
  'ปร.5.อาคาร!F12':     '=D12*E12',               // ค่าก่อสร้าง
  'ปร 5.ครุภัณฑ์!H10':   '=E10*(1+G10)',           // ครุภัณฑ์ ×(1+VAT)
  'ปร.6!F12':           "='ปร.5.อาคาร'!F12",       // ส่วนที่ 1
  'ปร.6!F13':           "='ปร 5.ครุภัณฑ์'!H20",     // ส่วนที่ 2
  'ปร.6!F23':           '=SUM(F12:F13)',           // รวม (หมายเหตุ: ไม่รวม F14 ส่วนที่ 3)
  'ปร.6!B26':           '=BAHTTEXT(F23)',          // ตัวอักษร — ต้อง uppercase, Excel-only
} as const;

/**
 * 1.ปร.4 — สรุปหมวด (กลุ่ม B: สูตรใน master)
 * ⚠️ ต้นฉบับสรุปเพียง 4 บรรทัด (r11–r14) และ "ข้ามหมวดไฟฟ้า" (ดึงสุขาภิบาลมาเป็นลำดับ 4)
 *    D18=SUM(D11:D16) มี slot ว่าง r15/r16 รองรับการเพิ่มไฟฟ้าได้
 *    → ดู README หัวข้อ "FLAG: หมวดไฟฟ้า" ก่อนใช้เป็น master ทั่วไป
 */
export const POR4_SUMMARY = {
  sumRange: 'D11:D16',
  rows: [
    { row: 11, nameRef: "='ปร4.อาคาร'!B7",   matRef: "='ปร4.อาคาร'!F19",  laborRef: "='ปร4.อาคาร'!H19" },
    { row: 12, nameRef: "='ปร4.อาคาร'!B20",  matRef: "='ปร4.อาคาร'!F31",  laborRef: "='ปร4.อาคาร'!H31" },
    { row: 13, nameRef: "='ปร4.อาคาร'!B32",  matRef: "='ปร4.อาคาร'!F96",  laborRef: "='ปร4.อาคาร'!H96" },
    // ⚠️ ต้นฉบับ r14 = สุขาภิบาล (ข้ามไฟฟ้า). master ทั่วไปควรเป็น:
    //    r14 = ไฟฟ้า  (B97 / F120 / H120)
    //    r15 = สุขาภิบาล (B121 / F176 / H176)
    { row: 14, nameRef: "='ปร4.อาคาร'!B121", matRef: "='ปร4.อาคาร'!F176", laborRef: "='ปร4.อาคาร'!H176" },
  ],
  total: { mat: 'D18', labor: 'E18', sum: 'F18' }, // F18 → ป้อน factor F!N9 และ ปร.5!D12
} as const;

/** workbook-level: บังคับ Excel คำนวณ chain ใหม่ตอนเปิด */
export const CALC = { fullCalcOnLoad: true, calcMode: 'auto' } as const;
