# prompt.md — แผนพัฒนา Drawing Measurement Engine MVP (5 Phase)

> เขียนโดย Claude (web) บทบาทสถาปนิก/ที่ปรึกษา ส่งต่อให้ **Claude Code** เป็นผู้เขียนโค้ด/ตรวจ bug/แก้ไข
> ทำ **ทีละ phase ตามลำดับ** ห้ามข้าม ห้ามทำหลาย phase พร้อมกัน
> แต่ละ phase มี: **เป้าหมาย 1 ประโยค → demo ที่ต้องทำได้ → acceptance (อ้างเลขข้อใน spec)**

---

## 0. กติกา (อ่านก่อนเริ่มทุกครั้ง)

อ่าน source of truth ตามลำดับ:
1. `docs/Drawing_Measurement_Engine_Specification_v1_0.md` — **สเปกหลักของงานรอบนี้** บังคับใช้ทุกข้อ
2. `docs/Development_Brief.md` — ภาพรวม product (บริบทกว้าง)
3. `CLAUDE.md` — Golden Rules + stack

**ขอบเขต:** เฉพาะ Drawing Measurement Engine MVP แบบ **web-first** เท่านั้น
**ห้ามทำ:** AI จริง, login, cloud, ระบบราคาเต็ม, DWG/DWF, auto-takeoff, BIM, real-time, **Electron packaging**

**กฎเหล็ก** (จาก CLAUDE.md §0): page-coordinate เก็บ geometry / hit-test ใน screen coord / core math เป็น pure + มี test / BOQ trace กลับได้ / AI ห้ามแก้เอง / offline ได้

**ทุก phase ทำแบบนี้:**
- ก่อนเขียน: สรุปสั้นๆ จะแตะไฟล์ไหน ทำตาม acceptance ข้อใด
- เขียนโค้ด + test
- จบ phase: รัน `npm run typecheck` + test ให้ผ่าน → **หยุดรายงาน + วิธีทดสอบด้วยมือ** → รอไฟเขียวก่อนไป phase ถัดไป
- ห้าม commit ถ้า typecheck/test ไม่ผ่าน (มี husky gate)

**รูปแบบรายงานจุดหยุด:**
```
## Phase X รายงานผล
- ทำอะไร (ไฟล์ที่แตะ) / typecheck / test ผ่านกี่ชุด
- demo ที่ทำได้ + วิธีทดสอบด้วยมือ
- acceptance ผ่านข้อใด / แตะ Golden Rule ใด / จุดเสี่ยง
- รอไฟเขียวก่อนไป phase ถัดไป
```

---

## Phase 0 — Scaffold (เตรียมพื้น ทำครั้งเดียว)

**เป้าหมาย:** มีโปรเจกต์ web ที่ run ได้ และ test infra พร้อม

- ตรวจว่ามี scaffold หรือยัง ถ้าไม่มี สร้าง: Vite + React + TypeScript(strict) + Zustand + react-konva + pdfjs-dist + xlsx + Vitest + ESLint + Prettier + husky
- ตั้ง npm scripts ตาม CLAUDE.md §4 (dev/typecheck/test/test:math/lint:fix/build)
- ตั้ง husky pre-commit ให้รัน typecheck + test:math จริง และยืนยันว่า commit ถูก block ถ้าไม่ผ่าน
- วาง type ทั้งหมดจาก spec §5,§8 ลง `src/types/` (ScreenPoint/PagePoint/RealPoint/ViewTransform/MeasurementType/MeasurementStatus/MeasurementGeometry/Measurement)

**Demo:** `npm run dev` เปิดหน้าเปล่าได้, `npm run test` รันได้
**Acceptance:** typecheck ผ่าน, husky gate ทำงาน, type ครบตาม spec
**หยุดรายงาน**

---

## Phase 1 — เห็นแบบ (Viewer + Thumbnail + Zoom/Pan)

**เป้าหมาย:** ผู้ใช้เปิด PDF หลายหน้า เลื่อน thumbnail เลือกหน้า ซูม/แพนได้ลื่น

ครอบคลุม: UI layout 4 โซน (spec §4) + Drawing import (spec §9.1) + Viewer (spec §3.1, §5)

- Layout: top toolbar (Select/Pan/Scale/Line/Polyline/Area/Rect/Count/Undo/Redo/AI), left thumbnail panel, center Konva canvas, right panel (tabs: Measurements/BOQ/AI), bottom status bar (scale/coord/tool/snap)
- Import PDF หลายหน้า (pdfjs-dist → image @2x ต่อหน้า เก็บ DrawingPage), JPG/PNG (หน้าเดียว); .dwg/.dwf → แจ้งให้ export PDF ก่อน
- Thumbnail sidebar: เรียงหน้า 1→สุดท้าย, scroll ขึ้น-ลง, แต่ละอันมีเลขหน้า+สถานะ scale(✓/⚠)+จำนวน measurement; active page ไฮไลต์ชัด; lazy render ถ้า 30+ หน้า
- คลิก thumbnail → `activePageId` (zustand, single source of truth) เปลี่ยน → canvas render หน้านั้น + fit
- Canvas: background raster layer + overlay layer; zoom (anchor ที่เมาส์)/pan/fit; status bar โชว์ cursor เป็น page coordinate + zoom%
- ใช้ `src/core/coords.ts` แปลงพิกัดจุดเดียว (จะทำเต็มใน Phase 2 แต่เริ่มใช้ที่นี่)

**Demo:** เปิด PDF 10 หน้า → thumbnail ครบ scroll ได้ → คลิกสลับหน้า → ซูม/แพนหน้าแบบลื่น จุดบนแบบไม่เพี้ยน
**Acceptance (spec §16.1):** เปิด PDF 10 หน้า thumbnail ครบเลือกได้; zoom/pan แล้ว align คงที่; activePageId sync sidebar↔canvas
**หยุดรายงาน**

---

## Phase 2 — เลขเชื่อถือได้ (Core Math + Scale)

**เป้าหมาย:** core math เขียว 100% และตั้ง scale แล้ววัดได้ตรงระยะจริง — พิสูจน์ว่าโปรแกรม "คำนวณแม่น" ก่อนลงทุนทำเครื่องมือครบ

ครอบคลุม: core math (spec §5.2,§5.3,§16) + Scale Tool (spec §9.2)

- `src/core/coords.ts` — screen↔stage↔page ตาม ViewTransform (round-trip ไม่เพี้ยน)
- `src/core/scale.ts` — calibrateScale, unitPerPixel, pixelPerUnit (แปลง m/mm)
- `src/core/geometry.ts` — distancePx, polylineLengthPx, polygonAreaPx2 (shoelace)
- `src/core/formula.ts` — line/polyline/polygon/rect/count → quantity ตามหน่วย
- เขียน unit test ให้ครบ (ดูค่าที่ถูกต้องในไฟล์ *.test.ts ที่ให้มาแล้ว — **ห้ามแก้ค่า**)
- Scale Tool: คลิก 2 จุด → preview line + pixel distance → dialog กรอกระยะจริง+หน่วย → unitPerPixel → เก็บ scale profile **ต่อ drawingPageId**; ไม่มี scale → tools เตือน

**Demo:** `npm run test` เขียวทั้งหมด → ตั้ง scale บนหน้าแบบ → วัดเส้นที่รู้ระยะ ได้ค่าตรง
**Acceptance (spec §9.2,§16):** test core เขียว 100%; pure (ไม่ import React/Konva); ตั้ง scale แล้ววัดเส้นเดิมได้ระยะใกล้เคียงค่าจริง; scale ผูกต่อหน้า
**หยุดรายงาน** ← จุดสำคัญ ที่ปรึกษาจะรีวิวเลขที่นี่

---

## Phase 3 — วัดได้จริง (Measurement Tools + Edit + Table)

**เป้าหมาย:** ผู้ใช้วัด line/polygon/rect/count แก้ไข/ลบ และเห็นปริมาณในตาราง

ครอบคลุม: tools (spec §6,§9.3-§9.6) + selection/editing/hit-test (spec §10) + table (spec §4)

- Line(2จุด)/Polyline(Enter,dblclick จบ)/Polygon Area(≥3จุด ปิดรูป) — draft preview ต่างจาก confirmed (spec §8.1: draft เส้นประเหลือง, confirmed เส้นทึบฟ้า), แสดงค่า real-time
- Rectangle (drag) + Count marker (group by category, นับ, เรียงเลข) + assign category พื้นฐาน
- keyboard: Esc cancel / Enter commit / Backspace ลบ node ล่าสุด (spec §6.1); drag threshold (spec §7.2: click<4px, drag≥4px)
- บันทึก Measurement object ครบ field (spec §8) เก็บ geometry เป็น page coordinate
- Select tool: hit-test **ใน screen coordinate** (radius คงที่) priority ตาม spec §10.1
- แก้ไข: drag node ย้าย/ลบ measurement/แก้ label-category → quantity update ทันที; Undo/Redo
- ตารางขวา: list measurement ของหน้า active; **สองทาง** คลิกแถว→highlight+zoom บน canvas, เลือกบน canvas→highlight แถว

**Demo:** วัด line/polygon/rect/count → แก้ node เห็นพื้นที่เปลี่ยน → ลบได้ → ตาราง↔canvas sync → zoom แล้ว hit ยังตรง
**Acceptance (spec §15.5,§15.6,§16.1):** line=pixelLength×unitPerPixel; polygon=shoelace×unitPerPixel²; draft≠confirmed; แก้ node แล้ว update; zoom แล้ว hit ถูก; ตาราง sync
**หยุดรายงาน**

---

## Phase 4 — ผูกราคา (BOQ Link + Traceability + Persistence + Export)

**เป้าหมาย:** ผูก measurement→BOQ, คลิก BOQ ย้อนกลับไปแบบ, save/load และ export ได้

ครอบคลุม: BOQ link (spec §15.7) + persistence + export (spec §17)

- data model BOQItem + MeasurementBOQLink (spec §8); ผูก 1 measurement→≥1 BOQ และ ≥1 measurement→1 BOQ ผ่าน formula link
- BOQ row แสดง quantity/unit/unitPrice/amount (amount=qty×price คำนวณ)
- **คลิก BOQ row → highlight measurement ต้นทาง + zoom ไป bounding box** (spec §15.7)
- แก้ measurement → BOQ qty update; ลบ measurement ที่ผูก BOQ → เตือนผลกระทบก่อนลบ (spec §16.1)
- Persistence: save/load project ลง **IndexedDB** (offline); export project JSON
- Export Excel (SheetJS): ชีต BOQ (รายการ/ปริมาณ/หน่วย/ราคา/รวม/หน้า/ref measurement) + ชีต Measurements (id/หน้า/type/quantity/unit/geometry page_px)

**Demo:** ผูก BOQ จากแบบ → คลิก BOQ row เด้งไป highlight ต้นทาง → ปิดเปิดแอป project ยังอยู่ → export Excel ยอดถูก ref ชี้กลับได้
**Acceptance (spec §15.7,§17):** สร้าง/ผูก BOQ; row ครบ; คลิก row highlight; แก้ measurement BOQ update; save/load offline; export ถูกต้อง trace ได้
**หยุดรายงาน**

---

## Phase 5 — AI ช่วยตรวจ (AI Review Hook — mock เท่านั้น)

**เป้าหมาย:** ส่ง payload (mock) รับ suggestion accept/reject

ครอบคลุม: AI hook stub (spec §15.8) — **ยังไม่ต่อ AI จริง**

- ปุ่ม AI Review → รวบรวม project+page+measurements+BOQ เป็น AIReviewRequest payload ตามสเปก
- ยังไม่เรียก service จริง → คืน mock AISuggestion[] แสดงใน AI panel + ปุ่ม Accept/Reject
- Accept missing item → สร้าง draft BOQ row source `ai_suggested`; Reject → เก็บ status rejected
- **AI ห้ามแก้ BOQ เอง** ผ่าน accept/reject เท่านั้น; AI fail ต้องไม่ทำ core พัง แสดง error ใน AI panel เท่านั้น (spec §16.1)

**Demo:** กด AI Review → เห็น mock suggestion → accept สร้าง draft row, reject เก็บสถานะ
**Acceptance (spec §15.8):** payload ตรงสเปก; mock แสดง; accept สร้าง draft; reject เก็บสถานะ
**หยุดรายงาน**

---

## หลังครบ Phase 5 — Definition of Done

รัน Critical QA Checklist (spec §16.1) + DoD table (spec §17) ทั้งหมด รายงานผ่าน/ไม่ผ่านแต่ละข้อ ก่อนถือว่า Engine v1 เสร็จ จากนั้นค่อยพิจารณาเฟสถัดไป (ห่อ Electron + SQLite, งานฐานราก/โครงสร้าง, AI จริง)
