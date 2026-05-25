# 🎯 Cursor Prompt — ปรับปรุง AI วิเคราะห์แบบ 4 ประเภทงาน

> คัดลอกทั้งหมดนี้วางใน Cursor

---

## งานที่ต้องทำ

ปรับปรุงระบบ AI วิเคราะห์แบบก่อสร้างใน `src/services/aiAnalyze.ts` และ UI ที่เกี่ยวข้อง ให้รองรับ **4 mode ประเภทงาน** พร้อม prompt เฉพาะทางแต่ละ mode ที่ละเอียดมาก

### หลักการสำคัญ
- AI = Qwen 3.5 Flash (dev-direct mode ผ่าน `VITE_QWEN_API_KEY_DEV`)
- endpoint: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions`
- model: `qwen3.5-flash`
- ตอบเป็น JSON เท่านั้น
- ภาษาไทยทั้งหมด (ยกเว้น JSON key)

---

## 1. สร้างไฟล์ `src/services/aiPrompts.ts` — เก็บ prompt แยก 4 mode

```typescript
// src/services/aiPrompts.ts
// ฐานความรู้ถอดปริมาณงานก่อสร้าง — 4 ประเภทงาน
// อ้างอิง: ค่าแรง ว.809 (14 พ.ย. 2568) + มาตรฐานวิศวกรรมไทย

export type DisciplineMode = 'architectural' | 'structural' | 'electrical' | 'sanitary';

export interface DisciplineOption {
  id: DisciplineMode;
  label: string;
  icon: string;
  description: string;
  color: string;
}

export const DISCIPLINE_OPTIONS: DisciplineOption[] = [
  {
    id: 'architectural',
    label: 'งานสถาปัตยกรรม',
    icon: '🏛️',
    description: 'พื้น ผนัง ประตู-หน้าต่าง ฝ้าเพดาน หลังคา สี',
    color: '#4A90D9'
  },
  {
    id: 'structural',
    label: 'งานโครงสร้าง',
    icon: '🏗️',
    description: 'ฐานราก เสา คาน พื้น คสล. บันได โครงหลังคาเหล็ก',
    color: '#E67E22'
  },
  {
    id: 'electrical',
    label: 'งานระบบไฟฟ้า',
    icon: '⚡',
    description: 'ดวงโคม สวิตช์ เต้ารับ สายไฟ ตู้ไฟ ระบบสื่อสาร',
    color: '#F1C40F'
  },
  {
    id: 'sanitary',
    label: 'งานระบบสุขาภิบาล',
    icon: '🚿',
    description: 'สุขภัณฑ์ ท่อประปา ท่อระบาย บ่อพัก ท่อน้ำฝน',
    color: '#2ECC71'
  }
];

// ═══════════════════════════════════════════
// SYSTEM PROMPT (ใช้ร่วมทุก mode)
// ═══════════════════════════════════════════
const SYSTEM_PROMPT = `คุณคือวิศวกรโยธาและสถาปนิกผู้เชี่ยวชาญถอดปริมาณงานก่อสร้างในประเทศไทย
อ้างอิงบัญชีค่าแรง ว.809 (14 พ.ย. 2568) กรมบัญชีกลาง

กฎเหล็ก:
1. ถอดเฉพาะสิ่งที่เห็นในแบบหน้านั้น ห้ามเดาสิ่งที่ไม่เห็น
2. ถ้าอ่านค่าไม่ชัด ให้ระบุว่า "ไม่ชัด — ต้องยืนยัน"
3. ระบุที่มาของตัวเลข (อ่านจากแบบ / คำนวณ / ประมาณ)
4. ราคาวัสดุเป็นราคาไกด์ที่แก้ได้
5. ตอบเป็น JSON เท่านั้น ห้ามมี markdown หรือข้อความอื่น
6. ตอบเป็นภาษาไทยทั้งหมด (ยกเว้น JSON key)`;

// ═══════════════════════════════════════════
// MODE 1: 🏛️ งานสถาปัตยกรรม
// ═══════════════════════════════════════════
const ARCHITECTURAL_PROMPT = `${SYSTEM_PROMPT}

คุณกำลังวิเคราะห์แบบ **งานสถาปัตยกรรม** เท่านั้น

## สิ่งที่ต้องหาจากแบบ:

### 1. งานพื้น (Floor Finish)
- อ่านสัญลักษณ์วัสดุพื้น (F1, F2, F3...)
- วัดพื้นที่แต่ละห้อง แยกตามชนิดวัสดุ (ตร.ม.)
- หักพื้นที่เสา ผนัง ช่องบันได
- วัสดุประกอบต่อ 1 ตร.ม. พื้นกระเบื้อง:
  กระเบื้อง 1.10 ตร.ม. (เผื่อ 10%), ปูนกาว 0.125 ถุง(40กก.), ยาแนว 0.3 กก., ปูนทรายรอง 0.03 ลบ.ม.
- ค่าแรง: ปูกระเบื้อง 24"×24" = 178 บาท/ตร.ม., 12"×12" = 178 บาท/ตร.ม., 8"×8" = 199 บาท/ตร.ม.

### 2. งานผนัง (Wall)
- แยกผนังภายนอก / ภายใน / ห้องน้ำ
- ชนิดผนัง (อิฐมวลเบา 7.5ซม. / คอนกรีตบล็อก / อิฐมอญ)
- พื้นที่ผนัง = ความยาว × ความสูง (ถ้าไม่ระบุสูงใช้ 2.80 ม.)
- หักช่องเปิดประตู-หน้าต่าง
- วัสดุต่อ 1 ตร.ม. ผนังอิฐมวลเบา 7.5ซม.:
  อิฐมวลเบา 9 ก้อน, ปูนก่อ 0.1 ถุง(50กก.), ปูนฉาบ 0.2 ถุง/ด้าน, สีรองพื้น 0.10 ลิตร/ด้าน, สีทับหน้า 0.22 ลิตร/ด้าน
- เสาเอ็น/ทับหลัง: ทุกช่วง ≤3.00ม. + รอบช่องเปิดทุกช่อง
- ค่าแรง: ก่ออิฐมวลเบา=73, ฉาบใน=96, ฉาบนอก=109, สีใน=31, สีนอก=35, เสาเอ็น=51 บาท/ม.

### 3. ประตู-หน้าต่าง (Door & Window)
- นับจำนวนแต่ละรหัส (บ1 บ2 น1 น2...)
- ขนาด กว้าง×สูง, ชนิด, วัสดุ, กระจก

### 4. ฝ้าเพดาน (Ceiling)
- พื้นที่ฝ้า ≈ พื้นที่ห้อง
- ชนิด: แคลเซียมซิลิเกต / ยิปซัม / PVC
- วัสดุต่อ 1 ตร.ม.: แผ่นฝ้า 1.10 ตร.ม., โครง T-bar 3.5 ม., ลวดแขวน 1.5 เส้น

### 5. หลังคา (Roof)
- พื้นที่หลังคาราบ = (กว้าง+ชายคา×2) × (ยาว+ชายคา×2)
- ตัวคูณความลาด: 15°=1.04, 20°=1.06, 25°=1.10, 30°=1.15, 35°=1.22
- กระเบื้อง = พื้นที่จริง × 1.10, ครอบสัน = ความยาวสันหลังคา

### 6. งานทาสีภายนอก
- ผนังภายนอกสุทธิ + ชายคา/เชิงชาย

## JSON Response Format:
{
  "discipline": "architectural",
  "drawing_type": "ผังพื้น/รูปด้าน/รูปตัด/ผังหลังคา",
  "scale": "1:xxx (อ่านจากแบบ)",
  "building_info": {
    "name": "ชื่ออาคาร",
    "dimensions": "กว้าง×ยาว ม.",
    "floor_area": 0,
    "stories": 1
  },
  "items": [
    {
      "category": "งานพื้น|งานผนัง|ประตู-หน้าต่าง|ฝ้าเพดาน|หลังคา|งานสี",
      "name": "ชื่อรายการ เช่น พื้นกระเบื้อง F1",
      "description": "รายละเอียด เช่น กระเบื้องเซรามิค 24×24 ซม.",
      "quantity": 0,
      "unit": "ตร.ม.|ม.|ชุด|จุด",
      "source": "อ่านจากแบบ|คำนวณ|ประมาณ",
      "materials": [
        { "name": "กระเบื้อง", "qty": 0, "unit": "ตร.ม.", "unit_price": 0, "note": "เผื่อ 10%" },
        { "name": "ปูนกาว 40กก.", "qty": 0, "unit": "ถุง", "unit_price": 0, "note": "" }
      ],
      "labor": { "description": "ปูกระเบื้อง", "rate": 178, "unit": "บาท/ตร.ม.", "ref": "ว.809" },
      "confidence": "high|medium|low"
    }
  ],
  "notes": ["หมายเหตุ/ข้อควรตรวจสอบ"],
  "unreadable": ["สิ่งที่อ่านไม่ชัด"]
}`;

// ═══════════════════════════════════════════
// MODE 2: 🏗️ งานโครงสร้าง
// ═══════════════════════════════════════════
const STRUCTURAL_PROMPT = `${SYSTEM_PROMPT}

คุณกำลังวิเคราะห์แบบ **งานโครงสร้าง** เท่านั้น

## น้ำหนักเหล็กเสริม (กก./ม.) = 0.006165 × d²
RB6=0.222, RB9=0.499, DB10=0.617, DB12=0.888, DB16=1.578, DB20=2.466, DB25=3.853, DB28=4.834, DB32=6.313

## ระยะหุ้มคอนกรีต (cover)
ฐานรากหล่อติดดิน=7.5ซม., สัมผัสดินมีlean=5.0ซม., คาน/เสา=2.5-4.0ซม., พื้น/ผนัง=2.0-2.5ซม.

## ค่าเผื่อ: เหล็ก +7%, คอนกรีต +3%

### 1. ฐานราก (Footing)
- ชื่อ F1,F2..., ขนาด B×L×t, เหล็กล่าง, จำนวน
- คอนกรีต = B×L×t, ไม้แบบ = 2(B+L)×t
- เหล็ก: จำนวนเส้น = ⌊(ด้านตั้งฉาก−2×cover)/ระยะ⌋+1, ยาว/เส้น = ด้านขนาน−2×cover+2×0.15
- เพิ่ม: ทราย 0.05ม., คอนกรีตหยาบ 0.05ม., ขุดดิน (เผื่อข้างละ 0.50ม.)

### 2. เสา (Column)
- ชื่อ C1,C2..., หน้าตัด b×h, สูง H
- เหล็กยืน (จำนวน-ขนาด เช่น 4-DB16), ปลอก (RB6@0.15)
- คอนกรีต=b×h×H, ไม้แบบ=2(b+h)×H
- เหล็กยืน=จำนวน×(H+ทาบ40d)×กก./ม.×1.07
- ปลอก: จำนวน=⌊H/ระยะ⌋+1, ยาว/ปลอก=2[(b−2×cover)+(h−2×cover)]+2×0.10

### 3. คาน (Beam)
- ชื่อ B1,B2,GB..., หน้าตัด b×h, ยาว L
- เหล็กบน/ล่าง + ข้าง, ปลอก
- คอนกรีต=b×h×L, ไม้แบบ=(2h+b)×L

### 4. พื้น คสล. (Slab)
- พื้นหล่อในที่: คอนกรีต=พื้นที่×หนา, ไม้แบบ=พื้นที่
- พื้นสำเร็จรูป: ตร.ม. + คอนกรีตทับหน้า 0.05ม.
- พื้นวางบนดิน: คอนกรีต + wire mesh + พลาสติก

### 5. บันได (Stair)
- คอนกรีต = พื้นเอียง + ขั้นสามเหลี่ยม

### 6. โครงหลังคาเหล็ก
- จันทัน, แป, ค้ำยัน: ขนาด × ยาว × จำนวน
- น้ำหนักเหล็กรูปพรรณ: □50×50×2.3=3.40, □75×75×2.3=5.22, □100×50×2.3=5.22, □100×100×3.2=9.41

## ค่าแรง ว.809:
เหล็ก<10มม.=4,900 บาท/ตัน, 10-16มม.=3,900, >16มม.=3,500
คอนกรีตผสมเสร็จชั้นเดียว=421 บาท/ลบ.ม., ผสมเอง=533, หยาบ=427
ไม้แบบ<5000ตร.ม.=163 บาท/ตร.ม., ขุดดิน<25ลบ.ม.=181 บาท/ลบ.ม.

## JSON Response Format:
{
  "discipline": "structural",
  "drawing_type": "แปลนฐาน/แปลนคาน/รายละเอียดเสา/Column Schedule/ตัด",
  "scale": "1:xxx",
  "building_info": { "name": "", "dimensions": "", "stories": 1 },
  "items": [
    {
      "category": "ฐานราก|เสา|คาน|พื้น|บันได|โครงหลังคาเหล็ก|งานดิน|คอนกรีตหยาบ",
      "name": "F1 ฐานรากเดี่ยว 1.50×1.50×0.30",
      "description": "เหล็ก DB12@0.20 ทั้ง 2 ทาง",
      "quantity": 30,
      "unit": "ฐาน",
      "source": "อ่านจากแบบ",
      "sub_items": [
        { "name": "คอนกรีต 240 ksc", "qty": 0.675, "unit": "ลบ.ม./ฐาน", "total_qty": 20.25, "unit_price": 2200, "note": "+3%" },
        { "name": "ไม้แบบ", "qty": 1.80, "unit": "ตร.ม./ฐาน", "total_qty": 54, "unit_price": 0, "note": "" },
        { "name": "เหล็ก DB12", "qty": 0, "unit": "กก./ฐาน", "total_qty": 0, "unit_price": 0, "note": "+7%" }
      ],
      "labor": { "description": "เทคอนกรีต", "rate": 421, "unit": "บาท/ลบ.ม.", "ref": "ว.809" },
      "confidence": "high|medium|low"
    }
  ],
  "notes": [],
  "unreadable": []
}`;

// ═══════════════════════════════════════════
// MODE 3: ⚡ งานระบบไฟฟ้า
// ═══════════════════════════════════════════
const ELECTRICAL_PROMPT = `${SYSTEM_PROMPT}

คุณกำลังวิเคราะห์แบบ **งานระบบไฟฟ้า** เท่านั้น

### 1. ดวงโคม/โคมไฟ (Lighting)
- นับจำนวนแต่ละชนิด: ฟลูออเรสเซนต์(ฝังฝ้า/ลอย), Downlight, ไฟทางเดิน/ฉุกเฉิน, ไฟนอก

### 2. สวิตช์+เต้ารับ
- สวิตช์ 1ทาง/2ทาง/3ทาง/Dimmer: จำนวน
- เต้ารับ เดี่ยว/คู่(Duplex)/กันน้ำ/3เฟส: จำนวน

### 3. สายไฟ+ท่อร้อยสาย
- ชนิดสาย: THW, NYY, VCT
- ขนาดสาย: 1×2.5, 2×2.5+1×2.5 ตร.มม.
- ท่อ: PVC/EMT/IMC ขนาด 1/2"-1"
- ประมาณยาว: ไฟแสงสว่าง≈5-8ม./จุด, เต้ารับ≈6-10ม./จุด

### 4. ตู้ไฟ+อุปกรณ์ป้องกัน
- MDB, Load Center, MCCB/MCB, ELCB/RCD, KWH Meter

### 5. ระบบอื่น
- พัดลมดูดอากาศ, กริ่ง, โทรศัพท์, เตือนไฟไหม้, สายดิน

### 6. ระบบสื่อสาร
- LAN, WiFi AP, CCTV

ราคาประมาณรวม (กรณีไม่มีรายละเอียด):
- อาคารทั่วไป ≈ 800-1,200 บาท/ตร.ม.
- อาคารพิเศษ (โรงพยาบาล) ≈ 1,200-2,000 บาท/ตร.ม.

## JSON Response Format:
{
  "discipline": "electrical",
  "drawing_type": "ผังไฟฟ้าแสงสว่าง/ผังเต้ารับ/Single Line Diagram/รายละเอียด",
  "scale": "1:xxx",
  "building_info": { "name": "", "floor_area": 0 },
  "items": [
    {
      "category": "ดวงโคม|สวิตช์-เต้ารับ|สายไฟ|ท่อร้อยสาย|ตู้ไฟ|ระบบอื่น|ระบบสื่อสาร",
      "name": "ดวงโคม LED 18W ฝังฝ้า 60×60",
      "description": "ตามผัง EE-01",
      "quantity": 24,
      "unit": "ชุด",
      "source": "นับจากแบบ",
      "unit_price": 0,
      "labor": { "description": "ติดตั้ง", "rate": 0, "unit": "บาท/จุด", "ref": "" },
      "confidence": "high|medium|low"
    }
  ],
  "notes": [],
  "unreadable": []
}`;

// ═══════════════════════════════════════════
// MODE 4: 🚿 งานระบบสุขาภิบาล
// ═══════════════════════════════════════════
const SANITARY_PROMPT = `${SYSTEM_PROMPT}

คุณกำลังวิเคราะห์แบบ **งานระบบสุขาภิบาล** เท่านั้น

### 1. สุขภัณฑ์ (Sanitary Fixtures)
- โถส้วมชักโครก(WC), นั่งยอง(SQ), อ่างล้างหน้า(LV), โถปัสสาวะ(UR)
- อ่างล้างจาน(SK), ฝักบัว(SH), สายฉีด, ก๊อกน้ำ
- อุปกรณ์เสริม: ที่ใส่สบู่ กระดาษ ราวแขวน กระจก

### 2. ท่อประปา (Water Supply)
- ø1/2"(15มม.)=ไปอุปกรณ์, ø3/4"(20มม.)=แยกย่อย, ø1"(25มม.)=หลักในอาคาร
- ø1-1/4"(32มม.)=จากมิเตอร์, ø1-1/2"(40มม.), ø2"(50มม.)=เมนใหญ่
- วัสดุ: PVC Class 8.5
- ประมาณยาว: หลัก=มิเตอร์ถึงจุดไกลสุด+10%, แยก=จำนวนจุด×3-5ม.
- อุปกรณ์ (ข้อต่อ วาล์ว) ≈ 15-20% ราคาท่อ

### 3. ท่อระบาย (Drainage)
- ø1-1/2"(40มม.)=อ่างล้างหน้า, ø2"(50มม.)=อ่างล้างจาน/ระบายพื้น
- ø3"(80มม.)=รวมหลายจุด, ø4"(100มม.)=ส้วม+หลัก, ø6"(150มม.)=ออกนอกอาคาร

### 4. บ่อพัก+บ่อบำบัด
- บ่อพัก(Manhole), บ่อเกรอะ(Septic), บ่อซึม, ถังเก็บน้ำ, ปั๊มน้ำ

### 5. ท่อน้ำฝน
- รางน้ำฝน, ท่อลง ø3"-4", ท่อระบายออก

### 6. รางระบาย+Floor Drain
- รางรูปตัว U, ฝาตะแกรง, Bell Trap/P-Trap

ราคาประมาณรวม:
- อาคารทั่วไป ≈ 500-800 บาท/ตร.ม.
- อาคารพิเศษ (โรงพยาบาล) ≈ 800-1,500 บาท/ตร.ม.

## JSON Response Format:
{
  "discipline": "sanitary",
  "drawing_type": "ผังสุขาภิบาล/ผังท่อประปา/ผังท่อระบาย/Isometric/รายละเอียด",
  "scale": "1:xxx",
  "building_info": { "name": "", "floor_area": 0 },
  "items": [
    {
      "category": "สุขภัณฑ์|ท่อประปา|ท่อระบาย|บ่อพัก-บำบัด|ท่อน้ำฝน|รางระบาย|Floor Drain",
      "name": "โถส้วมชักโครก",
      "description": "ชนิดสุขภัณฑ์พร้อมอุปกรณ์",
      "quantity": 6,
      "unit": "ชุด",
      "source": "นับจากแบบ",
      "unit_price": 0,
      "accessories": [
        { "name": "สายฉีดชำระ", "qty": 6, "unit": "อัน" }
      ],
      "confidence": "high|medium|low"
    }
  ],
  "notes": [],
  "unreadable": []
}`;

// ═══════════════════════════════════════════
// AUTO-DETECT PROMPT (ตรวจจับอัตโนมัติ)
// ═══════════════════════════════════════════
const AUTO_DETECT_PROMPT = `${SYSTEM_PROMPT}

ดูภาพแบบก่อสร้างนี้ แล้วระบุว่าเป็นแบบประเภทอะไร
ตอบเป็น JSON เท่านั้น:
{
  "detected_discipline": "architectural|structural|electrical|sanitary|unknown",
  "drawing_type": "ผังพื้น/แปลนฐาน/ผังไฟฟ้า/ผังสุขาภิบาล/...",
  "confidence": "high|medium|low",
  "reason": "เหตุผลสั้นๆ"
}`;

// Export function เลือก prompt ตาม mode
export function getPromptForMode(mode: DisciplineMode | 'auto'): string {
  switch (mode) {
    case 'architectural': return ARCHITECTURAL_PROMPT;
    case 'structural': return STRUCTURAL_PROMPT;
    case 'electrical': return ELECTRICAL_PROMPT;
    case 'sanitary': return SANITARY_PROMPT;
    case 'auto': return AUTO_DETECT_PROMPT;
  }
}

export function getUserPromptForMode(mode: DisciplineMode): string {
  const modeLabels: Record<DisciplineMode, string> = {
    architectural: 'งานสถาปัตยกรรม (พื้น ผนัง ประตู หน้าต่าง ฝ้า หลังคา สี)',
    structural: 'งานโครงสร้าง (ฐานราก เสา คาน พื้นคสล. บันได โครงหลังคา)',
    electrical: 'งานระบบไฟฟ้า (ดวงโคม สวิตช์ เต้ารับ สายไฟ ตู้ไฟ)',
    sanitary: 'งานระบบสุขาภิบาล (สุขภัณฑ์ ท่อประปา ท่อระบาย)'
  };
  return `วิเคราะห์ภาพแบบก่อสร้างนี้ ถอดปริมาณ ${modeLabels[mode]} อย่างละเอียดที่สุด
แยกรายการวัสดุ+ค่าแรงต่อรายการ ระบุที่มาของตัวเลข ตอบเป็น JSON ตาม format ที่กำหนด`;
}
```

---

## 2. แก้ไข `src/services/aiAnalyze.ts` — รองรับ mode parameter

เปลี่ยนฟังก์ชัน `analyzeDrawing` ให้รับ `mode: DisciplineMode | 'auto'` parameter:

```typescript
import { getPromptForMode, getUserPromptForMode, DisciplineMode } from './aiPrompts';

export async function analyzeDrawing(
  imageDataUrl: string,
  mode: DisciplineMode | 'auto' = 'auto'
): Promise<AnalysisResult> {
  
  let activeMode = mode;
  
  // ถ้า auto → ตรวจจับประเภทแบบก่อน แล้วค่อยวิเคราะห์
  if (mode === 'auto') {
    const detectResult = await callQwenAPI(imageDataUrl, getPromptForMode('auto'), 'ตรวจจับประเภทแบบ...');
    const detected = JSON.parse(detectResult);
    if (detected.detected_discipline && detected.detected_discipline !== 'unknown') {
      activeMode = detected.detected_discipline as DisciplineMode;
    } else {
      // ถ้าตรวจจับไม่ได้ ให้ user เลือกเอง
      return { needsUserSelection: true, detected };
    }
  }
  
  // วิเคราะห์ด้วย prompt เฉพาะ mode
  const systemPrompt = getPromptForMode(activeMode as DisciplineMode);
  const userPrompt = getUserPromptForMode(activeMode as DisciplineMode);
  
  const result = await callQwenAPI(imageDataUrl, systemPrompt, userPrompt);
  return { success: true, data: JSON.parse(result), mode: activeMode };
}
```

**สำคัญ**: ใช้ system prompt + user prompt แยกกัน:
- `messages[0]` = `{ role: "system", content: systemPrompt }`
- `messages[1]` = `{ role: "user", content: [{ type: "image_url", ... }, { type: "text", text: userPrompt }] }`

---

## 3. แก้ไข UI — เพิ่มตัวเลือก mode ก่อนกดวิเคราะห์

ที่ AI Analysis Panel (น่าจะอยู่ใน `src/components/AiPanel.tsx` หรือชื่อคล้ายกัน):

### ก่อนปุ่ม "🤖 วิเคราะห์หน้านี้ด้วย AI" ให้เพิ่ม:

1. **ปุ่มเลือก mode 4 ปุ่ม** (toggle button group):
   - 🏛️ สถาปัตย์ (สีฟ้า)
   - 🏗️ โครงสร้าง (สีส้ม)
   - ⚡ ไฟฟ้า (สีเหลือง)
   - 🚿 สุขาภิบาล (สีเขียว)
   - 🔄 อัตโนมัติ (สีเทา) ← default

2. **เมื่อเลือก "อัตโนมัติ"**: AI จะตรวจจับประเภทแบบก่อน ถ้าไม่มั่นใจจะถามให้เลือก

3. **เมื่อเลือก mode เฉพาะ**: ข้ามการตรวจจับ ใช้ prompt ตรง mode นั้นเลย

### Style:
- Dark theme ตาม UI ปัจจุบัน
- ปุ่มกลมมน แต่ละปุ่มมีไอคอน+ชื่อ
- ปุ่มที่เลือกอยู่มี border สีของ mode + background อ่อนๆ
- ฟอนต์ Sarabun

---

## 4. แก้ไขตารางผลวิเคราะห์ — แสดง materials แยก

ตอนนี้ผลวิเคราะห์แสดงเป็นตารางเรียบๆ ต้องเปลี่ยนให้:

1. **แสดงหมวดหมู่** (category) เป็น header กลุ่ม
2. **แต่ละ item** แสดง:
   - ชื่อรายการ + จำนวน + หน่วย
   - ปุ่มขยาย → เห็น materials ย่อย + ค่าแรง
   - สีตาม confidence (high=เขียว, medium=เหลือง, low=แดง)
3. **ช่อง source** แสดงที่มา (อ่านจากแบบ/คำนวณ/ประมาณ)
4. **ปุ่ม ✏️ แก้ไข** ทุก item → แก้ได้ทุกช่อง
5. **ปุ่ม ✅ Accept** → ส่งเข้า BOQ
6. **ปุ่ม ❌ Reject** → ไม่ใส่
7. **ปุ่ม "Accept ทั้งหมด"** → ส่งทุก item เข้า BOQ

---

## 5. สรุปไฟล์ที่ต้องแก้/สร้าง

| ไฟล์ | งาน |
|------|-----|
| `src/services/aiPrompts.ts` | **สร้างใหม่** — prompt 4 mode + types |
| `src/services/aiAnalyze.ts` | **แก้** — รับ mode param + ใช้ prompt จาก aiPrompts |
| AI Panel component | **แก้** — เพิ่มปุ่มเลือก mode 4+1 ปุ่ม |
| AI Results component | **แก้** — ตารางแสดง materials ย่อย + confidence + source |
| `src/stores/` (ถ้ามี) | **แก้** — เก็บ selectedMode ใน state |

---

## 6. ข้อกำหนดเพิ่มเติม

- ถ้า Qwen ตอบไม่ใช่ JSON ให้ลอง parse ด้วย regex หา `{...}` ก่อน
- Timeout 60 วินาที (แบบละเอียดใช้เวลา)
- แสดง loading animation ระหว่างรอ พร้อมข้อความ "🤖 AI กำลังวิเคราะห์งาน[ชื่อ mode]..."
- เก็บ mode ที่เลือกไว้ใน localStorage เพื่อครั้งหน้าไม่ต้องเลือกใหม่
- Console log: `[ai] Mode: ${mode} | Prompt length: ${prompt.length} chars`
