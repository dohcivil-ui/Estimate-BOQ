# ส่งออก Excel ราชการ (ปร.4–ปร.6) ด้วย Template-Fill

โปรแกรม**เปิด template ที่สูตร/format ครบแล้วเติมค่า** ไม่ใช่สร้างฟอร์มใหม่ทุกครั้ง
ที่มา: reverse-engineer จากไฟล์ตัวอย่าง `Attach_BOQ_1.xlsx` (อาคารเรียน ๓๒๔ ล.๕๕-ข)

## ไฟล์ในชุดนี้

| ไฟล์ | หน้าที่ | ที่อยู่ใน repo (เสนอ) |
|---|---|---|
| `boq-master.xlsx` | ฟอร์มเปล่า สูตร/chain/format/print/รูปครบ | `src/assets/templates/` |
| `govExcelMap.ts` | cell-map (input / chain / section) | `src/services/export/` |
| `govExcelExport.ts` | exporter ExcelJS (load→fill→save) | `src/services/export/` |

## วิธีใช้ (client-side, lazy-load)

```ts
async function exportBoq(data: BoqExportData) {
  const [{ fillBoqTemplate }, masterUrl] = await Promise.all([
    import('@/services/export/govExcelExport'),
    import('@/assets/templates/boq-master.xlsx?url').then(m => m.default),
  ]);
  const masterBuf = await fetch(masterUrl).then(r => r.arrayBuffer());
  const out = await fillBoqTemplate(masterBuf, data);
  // ดาวน์โหลด
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'BOQ.xlsx'; a.click();
}
```

## โครงสร้างข้อมูล (hierarchy: หมวด > หัวข้อย่อย > รายการ)

```ts
const data: BoqExportData = {
  meta: { projectName: '...', location: '...', province: 'หนองคาย', estimateDate: '...' },
  buildingItems: {
    1: [ { type: 'sub', name: '1.1 งานรื้อถอน' },
         { type: 'item', name: ' - รื้อผนัง', qty: 95, unit: 'ตร.ม.', matUnit: 0, laborUnit: 120 } ],
    2: [ /* หมวด 2 */ ], 3: [], 4: [], 5: [],
  },
  equipmentItems: [ { type: 'sub', name: 'งานครุภัณฑ์' }, /* items */ ],
  factorF: { advanceRate: 0, retentionRate: 0, rangeLow: 2_000_000, rangeHigh: 5_000_000, fLow: 1.3051, fHigh: 1.302 },
  conditions: { loanInterest: 0.06, vat: 0.07, equipmentVat: 0.07 },
};
```

## กฎสำคัญ (ห้ามพลาด)

1. **เขียนเฉพาะ input** — meta, ปริมาณ/ราคา (C/E/G อาคาร · D/F/H ครุภัณฑ์), เงื่อนไข + ช่วงตาราง Factor F. ห้ามแตะ formula (F/H/I, แถวรวม, factor F, ปร.5/ปร.6 chain)
2. **ส่ง number ดิบ** — เลขล็อกใน logic layer แล้ว ส่งดิบลงช่อง ให้ Excel คูณ/รวมตามสูตร master (อย่าส่งค่าที่ปัด/คำนวณแล้ว)
3. **`fullCalcOnLoad=true`** — exporter ตั้งให้แล้ว Excel คำนวณ chain ตอนเปิด
4. **ห้าม recalc ด้วย LibreOffice** ใน pipeline — มันเปลี่ยน `BAHTTEXT`→`bahttext` + print เพี้ยน
5. **ห้ามเปลี่ยนชื่อ sheet** (มีช่องว่างใน `ปร 5.ครุภัณฑ์` — ต้องตรง)

## ⚠️ FLAGS — ต้องเคาะก่อน production

1. **หมวดไฟฟ้าใน `1.ปร.4`** — ต้นฉบับสรุปแค่ 4 หมวด **ข้ามหมวดไฟฟ้า** (`ปร4.อาคาร` F120/H120) โดย r14 ดึงสุขาภิบาลแทน. ถ้าใช้เป็น master ทั่วไป (5 หมวด) ต้องเพิ่มแถวไฟฟ้า: master มี slot ว่าง r15/r16 และ `D18=SUM(D11:D16)` ครอบอยู่แล้ว ใส่ได้เลย —
   - `B14='ปร4.อาคาร'!B97`, `D14='ปร4.อาคาร'!F120`, `E14='ปร4.อาคาร'!H120` (ไฟฟ้า)
   - `B15='ปร4.อาคาร'!B121`, `D15='ปร4.อาคาร'!F176`, `E15='ปร4.อาคาร'!H176`, `F15=E15+D15` (สุขาภิบาล)
2. **ช่วงตาราง Factor F** — `rangeLow/High` + `fLow/High` ต้องเลือกคู่ช่วง CGD ให้ **ครอบค่างานต้นทุนจริง** มิฉะนั้น interpolate ผิด (เป็น extrapolate). ดึงจากตาราง CGD ตามค่างานต้นทุนที่ได้
3. **`ปร.6!F23=SUM(F12:F13)`** — ไม่รวม F14 (ส่วนที่ 3 ค่าใช้จ่ายพิเศษ) ตามต้นฉบับ. ถ้าโครงการมีส่วนที่ 3 ต้องแก้เป็น `SUM(F12:F14)`

## ทางขยาย: รายการเกิน slot (dynamic row)

exporter v1 = **fixed-slot** (รายการต่อหมวดต้องไม่เกินจำนวนแถว template). ถ้าเกิน → throw.
Production: ก่อนกรอก ให้ `ws.duplicateRow(section.lastItem, n, true)` เพื่อแทรก n แถว (คัดลอกสูตร/format/เส้นตาราง) **แล้วต้อง**:
- เลื่อน chain ref ที่อยู่ใต้จุดแทรกเอง (ExcelJS ไม่ปรับ cross-row ref อัตโนมัติ) — แถวรวมหมวด, `1.ปร.4` refs, แถวรวมใหญ่
- ทางเลือกที่ปลอดภัยกว่า: ทำ master ที่ "เผื่อ slot" แต่ละหมวดให้พอกับงานจริง แล้วคง fixed-slot

## หมายเหตุ master

`boq-master.xlsx` = ไฟล์ตัวอย่างที่ผ่านการ: ซ่อม chain ปร.5/ปร.6, ตัด `#REF!`/external link, ล้าง meta+ปริมาณ/ราคาเฉพาะโครงการ, ฝัง `F=C*E, H=C*G, I=F+H` ทุกแถวรายการ, ตั้ง `fullCalcOnLoad`. โครงสร้าง/สูตร/format/print/merge/รูป/ฟอนต์ (TH Sarabun New) ตรงต้นฉบับ. ผ่าน e2e: inject ค่างานต้นทุน → chain ไหล ปร.4→Factor F→ปร.5→ปร.6 ตรงตรวจมือ
