# Raster fixtures — REAL-GATE (geometric ±1%)

ที่นี่เก็บ PNG ของหน้าแบบ (rasterized จาก PDF) ที่ใช้เป็น **ground truth**
สำหรับ tests ใน `src/core/formula.realgate.test.ts`

> **ห้ามแต่ง pixel เอง** — ทุก px ต้องวัดจาก raster จริง

---

## SCOPE ของ "REAL-GATE" case นี้

ตรวจสองอย่าง:
1. **Scale + isotropy** — calibrate 1 แกน, verify อีกแกน → anisotropy ≤ 1%
2. **Grid envelope** — กรอบ grid 4 มุม (เช่น 1A/6A/6C/1C) ต้องคำนวณกลับเป็น
   ระยะคูณ-ระยะ ของ dim string (e.g. 26.00 × 14.00 = 364.00 m²) ภายใน ±1%

**ไม่ตรวจพื้นที่ห้อง/พื้นที่ผนังจริง** ในเคสนี้ — กรณีนั้นต้องหัก openings, ผนัง,
canopy, ฯลฯ ซึ่งเป็น scope ของ case อื่น (synthetic case-2 หรือ stage-b ภายหลัง)

---

## ทำไมต้อง raster (ไม่ใช้ PDF ตรงๆ)?

- pdfjs render ที่ DPI ต่างกัน → pixel coord เลื่อน → ค่า test เพี้ยน
- raster ที่ commit ลง git = canonical (sha256 verified) → ผลลัพธ์ deterministic
- พวกเราเทียบ "อ่าน px จาก raster" กับ "ระยะจริงในแบบ" → ±1% gate มีความหมาย

---

## ขั้นตอน (one-time setup ต่อหนึ่ง sheet)

### 1. Rasterize PDF page → PNG ที่ DPI 200 (คงที่)

**ตัวเลือก A — `pdftoppm` (poppler, แนะนำ):**
```bash
# Linux/macOS: brew install poppler  OR  apt install poppler-utils
# Windows: ติดตั้ง poppler binaries (https://github.com/oschwartz10612/poppler-windows)

pdftoppm -r 200 -f <page_number> -l <page_number> -png \
  "hemodyalysis_Electric_and_Sanitary_.pdf" sheet
# → ได้ sheet-<n>.png
```

**ตัวเลือก B — ImageMagick / `magick`:**
```bash
magick -density 200 "hemodyalysis_Electric_and_Sanitary_.pdf[<page_index>]" \
  -alpha remove -background white \
  raster/SN-02-raw.png
```

**ตัวเลือก C — Ghostscript:**
```bash
gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r200 \
  -dFirstPage=<n> -dLastPage=<n> \
  -sOutputFile=raster/SN-02-raw.png \
  "hemodyalysis_Electric_and_Sanitary_.pdf"
```

### 2. Crop เฉพาะบริเวณผัง (ไม่รวม title block / legend)

ใช้ GIMP / Photoshop / IrfanView ครอป
→ บันทึกเป็น `SN-02.png` ใน raster/ directory นี้

### 3. คำนวณ sha256 ของ PNG

```bash
# Linux/macOS:
sha256sum SN-02.png

# Windows PowerShell:
Get-FileHash -Algorithm SHA256 SN-02.png

# Windows cmd:
CertUtil -hashfile SN-02.png SHA256
```

→ เปิด `../raster-case-SN02.ts` แล้วเติม `imageSha256: '<lowercase-hex>'`

### 4. วัด pixel coordinates จาก raster

เปิด PNG ใน image viewer ที่อ่าน pixel position ได้
(GIMP: hover-readout / Photoshop: Info panel / IrfanView: status bar)

#### ⚠ กฎสำคัญตอนเลือกจุด

| ❌ ห้าม | ✅ ใช้แทน |
|---|---|
| `overall dim` 28.00 (อาจรวม cantilever/canopy นอก grid) | **grid-to-grid** 26.00 (1↔6) |
| มุมผนัง/มุมอาคารจริง | **grid intersection** (ศูนย์กลาง grid line) |
| ระยะจาก dim รวมที่บวกหลายช่อง | dim เดี่ยวที่ติดกับ grid โดยตรง |

#### จุดที่ต้องวัด

- **`calib.aPx` / `calib.bPx`** — grid intersection ของ grid 1 และ grid 6
  ระยะจริง `calib.realM = 26.00 m` (grid-to-grid; **ห้าม** ใช้ 28.00 overall)
- **`verify.aPx` / `verify.bPx`** — grid intersection ของ grid A และ grid C
  ระยะจริง `verify.realM = 14.00 m` (แกนตั้งฉาก, ตรวจ isotropy)
- **`footprintPx`** — **4 grid intersections** (ไม่ใช่มุมผนัง):
  - `1A` (มุม grid 1 × grid A) — top-left
  - `6A` (มุม grid 6 × grid A) — top-right
  - `6C` (มุม grid 6 × grid C) — bottom-right
  - `1C` (มุม grid 1 × grid C) — bottom-left
  ทั้ง 4 จุด clockwise from top-left → shoelace ของ envelope = `26.00 × 14.00 = 364.00 m²`

เติมค่า px ลง `../raster-case-SN02.ts` แทน `null`

### 5. Run tests

```bash
npm run test:math
```

`it.todo(...)` 4 ข้อใน `REAL-GATE — SN-02` จะปลดล็อกเป็น `it(...)` อัตโนมัติ
เมื่อ `isPxReady(c)` คืน true ทุกข้อต้องผ่าน (±1%)

---

## ถ้า test ไม่ผ่าน

| อาการ | สาเหตุที่เป็นไปได้ | วิธีจัดการ |
|---|---|---|
| sha256 mismatch | PNG ถูก re-save/แก้ | re-export PNG ที่ DPI เดิม + update sha256 |
| `verifyScale` throw (anisotropy > 1%) | scan เอียง, แบบไม่ to-scale | **log เป็น finding** ห้ามลด threshold; re-scan หรือใช้ sheet อื่น |
| `netArea` ออก 360 / 366 (เกิน ±1%) | อ่าน px ของมุม grid ผิด ~1px | re-measure 4 grid intersection อย่างละเอียด |
| `lengthPolyline` พลาด | อ่าน px ของ grid 1/6 หรือ A/C ผิด | ตรวจว่าใช้ระยะ grid-to-grid (26.00 / 14.00) ไม่ใช่ overall |

---

## เพิ่ม sheet ใหม่ (เช่น EE-02)

1. copy `raster-case-SN02.ts` → `raster-case-EE02.ts`
2. แก้ `sourceSheet`, `imageFile`, dim references, grid letters
3. ใน `formula.realgate.test.ts` เพิ่ม `runRealGate(caseEE02Raster);`
4. ทำขั้นตอน 1–4 ข้างบนกับ sheet ใหม่
