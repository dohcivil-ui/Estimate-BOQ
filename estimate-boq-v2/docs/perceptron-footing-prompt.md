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
You are analyzing a structural FOUNDATION PLAN (แปลนฐานราก) of a single-story building. Report counts + locations. Be precise and honest — if unclear, say so; NEVER invent values.

STEP 1 — GRID (do first): count vertical lines (1,2,3...) → N; horizontal (A,B...) → M; report N, M, intersections = N×M
STEP 2 — FOOTINGS (count by GRID, not label-text position): every intersection (N×M) normally has ONE main footing (identify type e.g. F2). A footing of a DIFFERENT type mid-span / off intersections is ADDITIONAL — count SEPARATELY, do NOT subtract from intersection count. Per type: type, count, grid positions. ⚠️ Do NOT treat label-text position as footing location.
STEP 3 — COLUMNS: count per type (C2, C3).
STEP 4 — GROUND BEAMS (คานคอดิน, GB1, GB2): report NUMBER OF BEAMS per type (count of members, NOT total length).
STEP 5 — DIMENSIONS (OCR): read visible numbers/sizes. If blurry or NOT shown, say "not shown / unclear" — DO NOT guess.
STEP 6 — LOCATE: give a bounding box for each detected footing.

OUTPUT: Grid N×M=? | Footings <type>=<count> @ <positions> | Columns <type>=<count> | Ground beams <type>=<count> beams | Dimensions <list or "not shown"> | Unclear ❓ <list>
```

## หมายเหตุ

- **subtract trap** — ฐานชนิดอื่นกลางช่วง (เช่น F1) นับเพิ่มแยก ห้ามลบออกจากจำนวนจุดตัด (STEP 2)
- **label-text ≠ ตำแหน่งฐาน** — ตำแหน่งฐานคือจุดตัด grid ไม่ใช่ตำแหน่งที่ตัวอักษร label วางอยู่
- **box convention** — ถ้า Perceptron mk1 คืนเป็น normalized 0–1000 หรือ `[ymin,xmin,ymax,xmax]` ตาม default ให้ยึด format ของโมเดล
- ถ้า output ขาดกลางคัน = max tokens ไม่พอ → เพิ่มค่า
