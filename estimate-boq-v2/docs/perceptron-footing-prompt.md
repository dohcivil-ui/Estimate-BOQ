# Perceptron mk1 — Prompt ถอดจำนวนฐานราก (grid-first + bounding box)

สำหรับทดสอบใน Playground ของ Perceptron (perceptron/perceptron-mk1)
ยึดกฎ grid-first เดิมของแอป (กฎ 11 / 12 / 12.5 ใน `src/services/aiPrompts.ts`)

## การตั้งค่า Playground

| ช่อง | ค่า |
|---|---|
| Model | `perceptron/perceptron-mk1` |
| แนบ | รูปแปลนฐานราก หน้า 17 (HD ที่สุดเท่าที่มี) |
| Temp | `0` (งานนับต้อง deterministic) |
| Max tokens | `1500` (ถ้าฐานเกิน ~40 จุด → เพิ่มเป็น 2500–3000 กัน boxes ถูกตัด) |
| Extra params | `{"annotation_format": "box"}` |

## Prompt (ใช้ทั้งบล็อก รวม STEP 6)

```
คุณเป็นผู้ช่วยถอดปริมาณงานวิศวกรรมโยธา วิเคราะห์ "แปลนฐานราก หน้า 17" ที่แนบมา
ภารกิจ: นับจำนวนฐานรากแต่ละชนิด (F1/F2/F3...) แบบ grid-first และคืนตำแหน่งเป็น bounding box

ทำตามขั้นตอนนี้ตามลำดับ ห้ามข้าม:

STEP 1 — อ่าน grid
- นับเส้นแกนยาว (1,2,3,...) = N เส้น และแกนสั้น (A,B,C,...) = M เส้น
- จำนวนจุดตัด grid ทั้งหมด = N × M

STEP 2 — ไล่ทุกจุดตัดทีละแถว
- ไล่จุดตัดทุกจุดในรูปแบบ <แกนยาว><แกนสั้น>:<ชนิด>
  เช่น 1A:F2 1B:F2 2A:F2 2B:F2 ... 6A:F2 6B:F2
- ที่จุดตัดเดียวกันถ้ามีหลาย mark ทับซ้อน (เช่น F2+C3) ยังนับฐานที่จุดนั้น
- อ่าน label จริงที่เขียนในแบบเท่านั้น ห้ามเดาตำแหน่งที่ไม่เห็น label

STEP 3 — ฐานนอกจุดตัด
- ฐานพิเศษกลางช่วง (เช่น F1 กลาง grid 1) นับแยกต่างหาก
- การมีฐานกลางช่วง "ไม่ลด" จำนวนฐานที่จุดตัด (ระวัง subtract trap)

STEP 4 — cross-check
- ผลรวมฐานทุกชนิด ต้อง = จำนวน mark ที่เห็นจริงทั้งหมด
- ถ้าทุกจุดตัดเป็น F2 และ grid = 6×2 → F2 ต้อง = 12 เป๊ะ (ห้าม 10/11/13)

STEP 5 — สรุปจำนวนต่อชนิด
- เขียนจำนวนสุดท้ายของแต่ละชนิด พร้อมขนาด B×L×t ถ้าอ่านได้

STEP 6 — คืน bounding box (สำคัญ)
- คืน 1 box ต่อ 1 mark ฐานราก ที่เห็นในแบบ
- box = [x1,y1,x2,y2] พิกัด pixel ของภาพต้นฉบับ (มุมบนซ้าย→ล่างขวา)
- แต่ละ box แนบ label ชนิดฐาน + grid coordinate

คืนผลเป็น JSON เดียวเท่านั้น (ไม่ต้องมีคำอธิบายนอก JSON):
{
  "grid": { "long_axis": N, "short_axis": M, "intersections": N*M },
  "trace": "1A:F2 1B:F2 2A:F2 ...",
  "counts": [
    { "type": "F2", "size": "1.50x1.50x0.30", "count": 12 },
    { "type": "F1", "size": "1.80x1.80x0.35", "count": 2 }
  ],
  "boxes": [
    { "label": "F2", "grid": "1A", "box": [x1,y1,x2,y2] },
    { "label": "F2", "grid": "1B", "box": [x1,y1,x2,y2] }
  ],
  "total": 14
}
```

## หมายเหตุ

- **box convention** — กำหนดเป็น `[x1,y1,x2,y2]` pixel มุมบนซ้าย→ล่างขวา
  ถ้า Perceptron mk1 คืนเป็น normalized 0–1000 หรือ `[ymin,xmin,ymax,xmax]` ตาม default
  ให้ยึด format ของโมเดลแล้วปรับ STEP 6 ให้ตรง
- ถ้า JSON ขาดกลางคัน (boxes ถูกตัด) = max tokens ไม่พอ → เพิ่มค่า
