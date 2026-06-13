/**
 * govExcelMap.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Single source of truth สำหรับการกรอก Template ราชการ (ปร.4 / Factor F / ปร.5 / ปร.6)
 * ลงไฟล์ boq-master.xlsx ด้วย ExcelJS
 *
 * หลักการ: exporter เขียนเฉพาะ "input cell" (กลุ่ม A) เท่านั้น
 *          formula / chain / format / print / merge / รูป ทั้งหมดอยู่ใน master แล้ว — ห้ามแตะ
 *
 * ที่มาของ mapping: derive จาก row-map จริงของ boq-master-cgd.xlsx (ฟอร์ม CGD มาตรฐาน)
 * โครงใหม่: ส่วนที่ 1 = 12 section / 3 กลุ่มงาน — พิสูจน์ recalc แล้ว ปร.6 = 13,938,000 ตรง PDF
 *   (อาคารเรียน 324 ล./55-ข) · Factor F = CEILING 4dp = 1.2965 · ยอดสุทธิ floor-พัน ทั้ง ปร.5ก/ข
 * ─────────────────────────────────────────────────────────────────────────
 */

/** ลำดับ sheet (ห้ามเปลี่ยนชื่อ — สูตร cross-sheet ผูกกับชื่อ) */
export const SHEET_ORDER = [
  'factor F',      // hidden — คำนวณ Factor F (interpolate, CEILING) + 2 รูป
  '1.ปร.4',        // สรุป 12 section / 3 กลุ่มงาน
  'ปร4.อาคาร',     // รายละเอียดงานอาคาร = ส่วนที่ 1 ทั้งหมด (input หลัก)
  'ปร4.ครุภัณฑ์',  // รายละเอียดครุภัณฑ์ = ส่วนที่ 2
  'ปร.5.อาคาร',    // สรุปค่าก่อสร้าง (ปร.5ก)
  'ปร 5.ครุภัณฑ์',  // สรุปครุภัณฑ์ (ปร.5ข)  ← มีช่องว่างในชื่อ
  'ปร.6',          // สรุปราคากลางรวม
] as const;

/**
 * META — ช่องหัวกระดาษเฉพาะโครงการ (กลุ่ม A: input)
 * แถวหัว (1–6 ของ ปร4.อาคาร / 1–10 ของ 1.ปร.4) ไม่เปลี่ยนตอนรื้อ section → cell เดิม
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
 * ปร4.อาคาร — ส่วนที่ 1 ค่างานต้นทุน = 12 section / 3 กลุ่มงาน
 * คอลัมน์: C=ปริมาณ, D=หน่วย, E=ราคาวัสดุ/หน่วย, F=เงินวัสดุ(สูตร =C*E),
 *          G=ราคาแรง/หน่วย, H=เงินแรง(สูตร =C*G), I=รวม(สูตร =F+H)
 * exporter เขียนเฉพาะ C/D/E/G ในช่วง firstItem..lastItem (F/H/I เป็นสูตรใน master)
 * total ต่อ section = SUM(col firstItem:lastItem) ทั้ง F/H/I (start row ตรงกัน — แก้ quirk เดิม 8 vs 9)
 *
 * model B (รื้อถอนแยก range): code1 = รื้อถอน, code2 = โครงสร้างวิศวกรรม 1.2–1.8
 *   หน้า detail มีบรรทัด display "รวมค่างานโครงสร้างวิศวกรรมทั้งหมด" (row 46) = total(1)+total(2) = 1,262,142
 *   สรุป 1.ปร.4 อ้าง total(1) และ total(2) ตรง ๆ (ไม่ลบ)
 */
export const BUILDING = {
  cols: { qty: 'C', unit: 'D', matUnit: 'E', matAmt: 'F', laborUnit: 'G', laborAmt: 'H', total: 'I' },
  /** group=กลุ่มงาน 1|2|3 · header=แถวหัว section · firstItem..lastItem=ช่วงรายการ · total=แถวรวม section */
  sections: [
    { code: 1,  group: 1, name: 'งานรื้อถอน',                                  header: 10,  firstItem: 11,  lastItem: 16,  total: 17 },
    { code: 2,  group: 1, name: 'งานโครงสร้างวิศวกรรม (1.2–1.8)',              header: 18,  firstItem: 19,  lastItem: 44,  total: 45 },
    { code: 3,  group: 1, name: 'งานสถาปัตยกรรม',                              header: 47,  firstItem: 48,  lastItem: 137, total: 138 },
    { code: 4,  group: 1, name: 'งานระบบสุขาภิบาล ดับเพลิง และป้องกันอัคคีภัย', header: 139, firstItem: 140, lastItem: 164, total: 165 },
    { code: 5,  group: 1, name: 'งานระบบไฟฟ้าและสื่อสาร',                       header: 166, firstItem: 167, lastItem: 186, total: 187 },
    { code: 6,  group: 1, name: 'งานระบบปรับอากาศและระบายอากาศ',               header: 188, firstItem: 189, lastItem: 196, total: 197 },
    { code: 7,  group: 1, name: 'งานระบบลิฟท์และบันไดเลื่อน',                   header: 198, firstItem: 199, lastItem: 202, total: 203 },
    { code: 8,  group: 1, name: 'งานระบบเครื่องกลและระบบพิเศษอื่นๆ',            header: 204, firstItem: 205, lastItem: 208, total: 209 },
    { code: 9,  group: 2, name: 'งานครุภัณฑ์จัดจ้างหรือสั่งทำ',                 header: 212, firstItem: 213, lastItem: 218, total: 219 },
    { code: 10, group: 2, name: 'งานตกแต่งภายในอาคาร',                         header: 220, firstItem: 221, lastItem: 224, total: 225 },
    { code: 11, group: 3, name: 'งานภูมิทัศน์',                                header: 228, firstItem: 229, lastItem: 232, total: 233 },
    { code: 12, group: 3, name: 'งานผังบริเวณและงานก่อสร้างประกอบอื่นๆ',        header: 234, firstItem: 235, lastItem: 238, total: 239 },
  ],
  /** แถว display (สูตรใน master — ห้ามเขียนทับ) */
  structCombinedRow: 46,                          // รวมโครงสร้างวิศวกรรมทั้งหมด = F17+F45
  groupTotalRows: { 1: 210, 2: 226, 3: 240 },     // รวมค่างานกลุ่มที่ 1/2/3
  grandTotalRow: 241,                             // รวมค่างานส่วนที่ 1 ทั้งหมด
} as const;

/**
 * ปร4.ครุภัณฑ์ — ส่วนที่ 2 (single range v1) · คอลัมน์เลื่อน 1 ช่อง
 * D=จำนวน, E=หน่วย, F=ราคาวัสดุ, G=เงินวัสดุ(สูตร), H=ราคาแรง, I=เงินแรง(สูตร), J=รวม(สูตร)
 * (การแตกเป็น 6 หมวดตาม ปร.4(ข) ทำเป็น display ภายหลัง — ไม่กระทบ chain J18)
 */
export const EQUIPMENT = {
  cols: { qty: 'D', unit: 'E', matUnit: 'F', matAmt: 'G', laborUnit: 'H', laborAmt: 'I', total: 'J' },
  firstItem: 8, lastItem: 16, total: 17, // G17=SUM(G8:G16); แถว 18 mirror → J18 ส่งเข้า ปร.5(ข)
} as const;

/**
 * Factor F — input เงื่อนไข + ช่วงตารางเทียบ (กลุ่ม A)
 * ส่วน interpolate (N26 = CEILING(V26,0.0001)) เป็นสูตร — ห้ามแตะ
 */
export const FACTOR_F = {
  advanceRate: 'factor F!E14',     // เงินล่วงหน้าจ่าย
  retentionRate: 'factor F!E15',   // เงินประกันผลงานหัก
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
 * เก็บเป็นเอกสารอ้างอิง / ใช้ตรวจว่า master ยังครบ · ✅ 3 FLAG ปิดแล้ว
 */
export const CHAIN_FORMULAS = {
  'factor F!N9':        "='1.ปร.4'!F29",          // ค่างานต้นทุน (grand) → Factor F
  'factor F!N26':       '=CEILING(V26,0.0001)',   // Factor F สุดท้าย ปัดขึ้น 4dp [FLAG1]
  'ปร.5.อาคาร!D12':     "='1.ปร.4'!F29",          // ค่างานต้นทุน
  'ปร.5.อาคาร!E12':     "='factor F'!N26",        // Factor F
  'ปร.5.อาคาร!F12':     '=D12*E12',               // ค่าก่อสร้าง (gross)
  'ปร.5.อาคาร!F18':     '=F12',                   // รวมราคาค่าก่อสร้าง
  'ปร.5.อาคาร!F19':     '=FLOOR(F12,1000)',       // ยอดสุทธิ ปัดลงหลักพัน [FLAG2]
  'ปร 5.ครุภัณฑ์!H10':   '=E10*(1+G10)',           // ครุภัณฑ์ ×(1+VAT) (gross)
  'ปร 5.ครุภัณฑ์!H20':   '=FLOOR(H10,1000)',       // ยอดสุทธิ ปัดลงหลักพัน [FLAG2]
  'ปร.6!F12':           "='ปร.5.อาคาร'!F19",       // ส่วนที่ 1 (ดึงตัวปัดแล้ว) [FLAG2]
  'ปร.6!F13':           "='ปร 5.ครุภัณฑ์'!H20",     // ส่วนที่ 2 (ดึงตัวปัดแล้ว) [FLAG2]
  'ปร.6!F23':           '=SUM(F12:F13)',           // รวมทั้งสิ้น (ไม่รวม F14 ส่วนที่ 3)
  'ปร.6!B26':           '=BAHTTEXT(F23)',          // ตัวอักษร — Excel-only (LibreOffice = #NAME?, Tier 2 ต้อง exclude)
} as const;

/**
 * 1.ปร.4 — สรุป 12 section / 3 กลุ่มงาน (กลุ่ม B: สูตรใน master)
 * แต่ละ line: D=ref ปร4.อาคาร!F{total} (วัสดุ), E=ref !H{total} (แรง), F==D+E
 * ✅ ครบทุก section รวมไฟฟ้า (code5) → ไม่มีหมวดตกอีก [FLAG3]
 * grand F29 → ป้อน factor F!N9 และ ปร.5ก!D12
 */
export const POR4_SUMMARY = {
  lines: [
    { code: 1,  row: 12, nameRef: "='ปร4.อาคาร'!B10",  matRef: "='ปร4.อาคาร'!F17",  laborRef: "='ปร4.อาคาร'!H17" },
    { code: 2,  row: 13, nameRef: "='ปร4.อาคาร'!B18",  matRef: "='ปร4.อาคาร'!F45",  laborRef: "='ปร4.อาคาร'!H45" },
    { code: 3,  row: 14, nameRef: "='ปร4.อาคาร'!B47",  matRef: "='ปร4.อาคาร'!F138", laborRef: "='ปร4.อาคาร'!H138" },
    { code: 4,  row: 15, nameRef: "='ปร4.อาคาร'!B139", matRef: "='ปร4.อาคาร'!F165", laborRef: "='ปร4.อาคาร'!H165" },
    { code: 5,  row: 16, nameRef: "='ปร4.อาคาร'!B166", matRef: "='ปร4.อาคาร'!F187", laborRef: "='ปร4.อาคาร'!H187" },
    { code: 6,  row: 17, nameRef: "='ปร4.อาคาร'!B188", matRef: "='ปร4.อาคาร'!F197", laborRef: "='ปร4.อาคาร'!H197" },
    { code: 7,  row: 18, nameRef: "='ปร4.อาคาร'!B198", matRef: "='ปร4.อาคาร'!F203", laborRef: "='ปร4.อาคาร'!H203" },
    { code: 8,  row: 19, nameRef: "='ปร4.อาคาร'!B204", matRef: "='ปร4.อาคาร'!F209", laborRef: "='ปร4.อาคาร'!H209" },
    { code: 9,  row: 22, nameRef: "='ปร4.อาคาร'!B212", matRef: "='ปร4.อาคาร'!F219", laborRef: "='ปร4.อาคาร'!H219" },
    { code: 10, row: 23, nameRef: "='ปร4.อาคาร'!B220", matRef: "='ปร4.อาคาร'!F225", laborRef: "='ปร4.อาคาร'!H225" },
    { code: 11, row: 26, nameRef: "='ปร4.อาคาร'!B228", matRef: "='ปร4.อาคาร'!F233", laborRef: "='ปร4.อาคาร'!H233" },
    { code: 12, row: 27, nameRef: "='ปร4.อาคาร'!B234", matRef: "='ปร4.อาคาร'!F239", laborRef: "='ปร4.อาคาร'!H239" },
  ],
  groupTotals: [
    { group: 1, row: 20, lineRows: [12, 13, 14, 15, 16, 17, 18, 19] },
    { group: 2, row: 24, lineRows: [22, 23] },
    { group: 3, row: 28, lineRows: [26, 27] },
  ],
  grand: { row: 29, fromGroupRows: [20, 24, 28] }, // F29 = F20+F24+F28
  total: { mat: 'D29', labor: 'E29', sum: 'F29' },  // F29 → factor F!N9 และ ปร.5ก!D12
} as const;

/** workbook-level: บังคับ Excel คำนวณ chain ใหม่ตอนเปิด */
export const CALC = { fullCalcOnLoad: true, calcMode: 'auto' } as const;
