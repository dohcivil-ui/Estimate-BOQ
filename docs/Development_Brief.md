# Development Brief: โปรแกรมประมาณราคาก่อสร้างแบบ AI-Assisted Offline-First

ผู้จัดทำ: **Manus AI**  
วันที่: **21 พฤษภาคม 2026**  
สถานะเอกสาร: **ฉบับสรุปสำหรับเริ่มวางโค้ดและส่งต่อ Claude/Cursor/Codex**  
ขอบเขต: **ยังไม่ใช่ source code แต่เป็น Product + Technical Specification สำหรับให้ทีมพัฒนาเริ่มทำงานอย่างเป็นระบบ**

---

## 1. Executive Summary

โปรแกรมนี้ควรถูกออกแบบเป็น **Hybrid AI Estimating Platform** หรือ **Offline-First Estimating App with AI API Engine** โดยแกนหลักคือโปรแกรม desktop/offline ที่เปิดไฟล์แบบ วัดปริมาณ สร้าง BOQ และ export รายงานได้เอง ส่วน AI เป็นชั้นช่วยเสริมที่เชื่อมผ่าน **AI API Engine** เมื่อผู้ใช้ต้องการให้ช่วยตรวจ วิเคราะห์ หรือแนะนำรายการเพิ่มเติม

> **นิยามผลิตภัณฑ์:** โปรแกรมช่วยถอดปริมาณและประมาณราคาจากไฟล์แบบ โดยให้ผู้ใช้วัดจากแบบด้วยเครื่องมือคลิก node-to-node, polygon, count marker และ drag selection จากนั้นระบบผูกผลการวัดเข้ากับ BOQ พร้อมให้ AI ช่วยตรวจรายการตกหล่น ปริมาณผิดปกติ รายการซ้ำ และอธิบายที่มาของตัวเลขได้อย่างตรวจย้อนกลับได้

จุดยืนสำคัญของผลิตภัณฑ์ไม่ควรสื่อว่า “AI ทำราคาแทนผู้รับเหมา” แต่ควรสื่อว่า **AI ช่วยให้ BOQ ครบขึ้น ตรวจได้ และลดความเสี่ยงก่อนเสนอราคา** เพราะงานประมาณราคาก่อสร้างต้องการหลักฐาน ความน่าเชื่อถือ และการตรวจย้อนกลับได้มากกว่าคำตอบอัตโนมัติที่ไม่มีที่มา

---

## 2. Product Positioning

ผลิตภัณฑ์นี้ควรเริ่มจากการแก้ Pain Point ที่เกิดขึ้นจริงในงานถอดแบบและ BOQ คือผู้รับเหมาหรือ QS ทำ BOQ แล้วไม่มั่นใจว่า **ครบ ถูก และอธิบายย้อนกลับได้** โดยเฉพาะกรณีที่รายการ BOQ แตกต่างจากแบบ หรือแบบมีหลาย revision แล้วทำให้ต้นทุนหน้างานไม่ตรงกับประมาณการเดิม

| ประเด็น | แนวทางที่ควรวางตำแหน่ง |
|---|---|
| ประเภทผลิตภัณฑ์ | Desktop estimating software แบบ offline-first และต่อยอดเป็น online/cloud ได้ |
| จุดขายหลัก | BOQ ทุกบรรทัด trace กลับไปยังตำแหน่งบนแบบได้ |
| บทบาท AI | Co-pilot ที่ช่วยตรวจ แนะนำ และอธิบาย ไม่ใช่ autopilot ที่แก้ BOQ เอง |
| ผู้ใช้หลัก | ผู้รับเหมารายเล็ก-กลาง, QS, estimator, สถาปนิก/วิศวกรที่ต้องทำราคาเร็ว |
| งานเริ่มต้น | งานสถาปัตยกรรมและโครงสร้างพื้นฐาน |
| ไฟล์เริ่มต้น | PDF, JPG, PNG และ multi-page PDF |
| ไฟล์ phase ถัดไป | DWG, DWF, BIM/IFC หรือการแปลงไฟล์ CAD เป็น PDF/image ก่อนวัด |

> **Product Promise:** “ถอดแบบได้เร็วขึ้น ทำ BOQ ได้เป็นระบบ และตรวจย้อนกลับได้ว่าปริมาณแต่ละรายการมาจากตำแหน่งใดบนแบบ พร้อม AI ช่วยเตือนรายการที่อาจตกหล่นก่อนเสนอราคา”

---

## 3. Core User Workflow

Workflow ต้องใกล้เคียงวิธีทำงานจริงของผู้รับเหมาและ QS โดยเริ่มจากนำเข้าแบบ ตั้ง scale วัดปริมาณ ผูกสูตร สร้าง BOQ ตรวจด้วย AI และ export รายงาน โปรแกรมควรทำให้ผู้ใช้รู้สึกว่าใช้งานเหมือนโปรแกรมดูแบบผสม Excel แต่มี intelligence เพิ่มขึ้น

| ขั้นตอน | ผู้ใช้ทำอะไร | ระบบทำอะไร | AI ช่วยอะไร |
|---|---|---|---|
| 1. Create Project | สร้างโครงการ กำหนดชื่อ ลูกค้า ประเภทอาคาร | สร้าง project file และ local database | แนะนำ template ตามประเภทงานในอนาคต |
| 2. Import Drawing | นำเข้า PDF/JPG/PNG | แปลง PDF เป็น page images, เก็บ metadata | OCR ชื่อหน้า เลขแบบ revision แบบ optional |
| 3. Calibrate Scale | คลิก 2 จุดบนแบบแล้วใส่ระยะจริง | คำนวณ scale factor px/m หรือ px/mm | เตือนหาก scale ผิดปกติ |
| 4. Measure / Takeoff | คลิก line, polyline, polygon, count, drag select | สร้าง measurement object และ quantity | ช่วยแนะนำ boundary หรือรายการเกี่ยวข้อง |
| 5. Map to BOQ | เลือกหมวดงานและสูตร | ผูก measurement กับ BOQ item | แนะนำสูตรหรือรายการที่ควรมีร่วมกัน |
| 6. AI Review | กดตรวจ BOQ รายหน้า/รายหมวด/ทั้งโครงการ | สร้าง AI package ส่งเข้า AI API Engine | ตรวจ missing, duplicate, outlier, assumption |
| 7. Accept / Reject | เลือกยืนยันหรือปฏิเสธคำแนะนำ | บันทึก audit log | AI ไม่มีสิทธิ์แก้ BOQ เองโดยไม่ให้ผู้ใช้ยืนยัน |
| 8. Export | ส่งออก Excel/PDF/รายงาน | สร้าง BOQ พร้อม summary และ reference | ช่วยเขียนคำอธิบายสมมติฐานหรือจุดเสี่ยง |

หลักการสำคัญคือ **ทุก measurement ต้องเป็นข้อมูลจริง ไม่ใช่แค่เส้นที่วาดบน canvas** เพราะข้อมูลเหล่านี้จะถูกใช้สร้าง BOQ, export, ตรวจ diff และส่งให้ AI วิเคราะห์ในอนาคต

---

## 4. MVP Scope

MVP ต้องเล็กพอที่จะพัฒนาได้จริง แต่ต้องพิสูจน์คุณค่าเรื่องถอดปริมาณและ BOQ traceability ได้ชัดเจน จึงควรเริ่มจากงานที่มีความเสี่ยงต่ำกว่าการอ่าน CAD native แต่ให้คุณค่าทางธุรกิจเร็วที่สุด

| ด้าน | ต้องมีใน MVP | ยังไม่ควรทำใน MVP |
|---|---|---|
| File Input | PDF, multi-page PDF, JPG, PNG | DWG/DWF native, BIM/IFC native |
| Drawing Viewer | zoom, pan, page thumbnails, rotate, fit-to-screen | real CAD layer control เต็มรูปแบบ |
| Scale | ตั้ง scale จาก 2 จุด, scale ต่อหน้า | auto-scale ทุกแบบโดยไม่ให้ผู้ใช้ตรวจ |
| Measurement | line, polyline, polygon area, rectangle area, count marker, drag selection | full auto-takeoff ทั้งหน้า |
| BOQ | measurement table, formula mapping, BOQ table, subtotal | ERP/accounting/procurement integration |
| AI | AI review, suggest missing items, explain quantity, OCR บางส่วน | AI วัดทุกอย่างเองโดยไม่ให้คนยืนยัน |
| Export | Excel และ PDF/report เบื้องต้น | cloud approval workflow |
| Storage | local project file/database | multi-user sync real-time |

### ขอบเขตงานก่อสร้างใน MVP

งานสถาปัตยกรรมควรเริ่มจากรายการที่สัมพันธ์กับพื้นที่และเส้นชัดเจน เช่น พื้น ผนัง ฉาบ สี ฝ้า กระเบื้อง บัว ประตูหน้าต่าง และงานกันซึมเบื้องต้น ส่วนงานโครงสร้างควรเริ่มจาก concrete/slab/column/beam/wall ในรูปแบบที่ผู้ใช้วัดหรือกรอก factor เองก่อน ไม่ควรเริ่มจากการอ่าน rebar schedule หรือแบบเหล็กเสริมอัตโนมัติในรอบแรก

| หมวดงาน | รายการที่เหมาะกับ MVP | หมายเหตุ |
|---|---|---|
| พื้น | พื้นที่ห้อง, กระเบื้อง, ปูนปรับระดับ, กันซึม | วัดด้วย polygon/rectangle |
| ผนัง | ก่อผนัง, ฉาบ, สี, กระเบื้องผนัง | วัดจาก length x height หรือ area |
| ฝ้า | พื้นที่ฝ้า, โครงคร่าว, แผ่นฝ้า | วัดพื้นที่ |
| ประตู/หน้าต่าง | จำนวน, ขนาด, ประเภท | ใช้ count marker และ category |
| โครงสร้าง | slab, wall, column/beam แบบคำนวณ factor | เริ่มจาก manual measurement + formula |

---

## 5. Drawing Measurement Engine v1

หัวใจของโปรแกรมคือ **Drawing Measurement Engine** ซึ่งเป็นส่วนที่ทำให้ผู้ใช้โต้ตอบกับแบบได้เหมือนตัวอย่างใน TikTok ได้แก่การคลิก node-to-node เพื่อวัดระยะหรือพื้นที่ และการลากเมาส์คลุมเพื่อเลือก object/region โปรแกรมต้องออกแบบส่วนนี้ให้แน่นก่อน เพราะ AI และ BOQ จะทำงานดีได้ก็ต่อเมื่อข้อมูล measurement ถูกต้อง

### 5.1 Canvas Interaction Requirements

| Feature | พฤติกรรมที่ต้องการ | Acceptance Criteria |
|---|---|---|
| Pan | ผู้ใช้ลาก canvas เพื่อเลื่อนแบบ | pan ได้ลื่น ไม่กระทบตำแหน่ง measurement |
| Zoom | scroll wheel หรือปุ่ม zoom | zoom เข้าออกโดย measurement ยัง align กับแบบ |
| Page Thumbnail | แสดงหน้า PDF ด้านซ้าย | คลิกหน้าแล้วเปลี่ยน canvas ได้ |
| Tool Mode | select, scale, line, area, count, rectangle, lasso | เปลี่ยน tool แล้ว cursor/interaction เปลี่ยนตาม |
| Snap Optional | snap กับจุดเดิมหรือ vertex เดิม | เปิด/ปิดได้ในภายหลัง |
| Undo/Redo | ย้อน measurement ล่าสุด | undo แล้ว table/BOQ link ต้อง sync |
| Highlight | คลิก BOQ แล้ว highlight measurement บนแบบ | ผู้ใช้เห็นที่มาของปริมาณทันที |

### 5.2 Measurement Tools

| Tool | วิธีใช้งาน | Quantity ที่ได้ | Geometry ที่ต้องเก็บ |
|---|---|---|---|
| Scale Tool | คลิก 2 จุดที่รู้ระยะจริงแล้วกรอกระยะ | scale factor | line segment พร้อม real_length |
| Line Tool | คลิกจุดเริ่มและจุดจบ | length | points array |
| Polyline Tool | คลิกหลาย node ต่อเนื่อง | total length | ordered points array |
| Area Polygon Tool | คลิก node หลายจุดแล้วปิด polygon | area, perimeter | closed polygon points |
| Rectangle Area Tool | drag สี่เหลี่ยม | area, width, height | rectangle bounds |
| Count Tool | คลิกวาง marker | count | point marker + category |
| Drag Select | ลากคลุม region/object | selected region/crop | rectangle หรือ lasso path |
| Lasso Select | ลากเส้นอิสระคลุม object | selected irregular region | freeform path |

### 5.3 Node-to-Node Measurement

การคลิก node-to-node ต้องทำงานแบบ deterministic และตรวจสอบได้ ผู้ใช้ต้องสามารถวาง node ย้าย node ลบ node และเห็นค่าปริมาณ update ทันที การคำนวณต้องยึด coordinate system ของหน้าแบบเป็นหลัก ไม่ใช่ตำแหน่งบนหน้าจอหลัง zoom/pan

| Requirement | รายละเอียด |
|---|---|
| Coordinate System | เก็บพิกัดใน page coordinate เช่น x/y เป็น pixel ของ original rendered page |
| Scale Conversion | real_length = pixel_length / pixels_per_meter หรือสูตรที่กำหนด |
| Area Calculation | ใช้ polygon area จาก coordinate แล้วแปลงเป็นหน่วยจริงตาม scale |
| Editing | ผู้ใช้ลาก node เพื่อแก้ shape ได้ |
| Visual Feedback | แสดง temporary line ขณะคลิก และแสดง label เช่น 3.45 m หรือ 12.80 m² |
| Closing Polygon | double click หรือกด Enter เพื่อปิด polygon |

### 5.4 Drag Selection / Object Selection

Drag selection ใน MVP ไม่จำเป็นต้อง detect object อัตโนมัติเต็มรูปแบบทันที แต่ควรใช้เป็นกลไกเลือก region เพื่อให้ผู้ใช้ assign category หรือส่ง crop ให้ AI วิเคราะห์ภายหลังได้

| ระดับ | ความสามารถ | ควรทำเมื่อใด |
|---|---|---|
| Level 1 | ลาก rectangle ครอบพื้นที่และบันทึกเป็น selected region | MVP |
| Level 2 | ส่ง selected region ให้ AI อ่านว่าเป็นห้อง/ผนัง/ประตู/สัญลักษณ์อะไร | MVP ปลายหรือ Phase 1.5 |
| Level 3 | image processing หา contour/line/object ภายใน region | Phase 2 |
| Level 4 | auto-takeoff จากทั้งหน้าแบบ | Phase 3 |

---

## 6. BOQ and Formula Engine

โปรแกรมไม่ควรแค่บันทึกปริมาณ แต่ต้องแปลงปริมาณเป็น BOQ ที่มีสูตรและ unit price ได้ ผู้ใช้ต้องสามารถแก้ factor, wastage, unit price และคำอธิบายได้เอง เพราะการประมาณราคาก่อสร้างมีสมมติฐานตามพื้นที่และวิธีทำงานของแต่ละบริษัท

| Component | หน้าที่ |
|---|---|
| Measurement Table | แสดงรายการที่วัดได้ เช่น พื้นที่ห้อง ความยาวผนัง จำนวนประตู |
| Category Mapping | ผูก measurement กับหมวดงาน เช่น พื้น ผนัง ฝ้า โครงสร้าง |
| Formula Template | แปลง measurement เป็น BOQ item เช่น wall_length x height = wall_area |
| BOQ Table | รวมรายการ description, quantity, unit, unit price, amount |
| Trace Link | BOQ row ต้องรู้ว่ามาจาก measurement ใด |
| Export Engine | ส่งออก Excel/PDF พร้อมสรุปและ reference |

ตัวอย่างสูตรที่ควรรองรับใน MVP คือพื้นที่พื้นไปยังงานปูกระเบื้อง, พื้นที่ห้องน้ำไปยังงานกันซึม, ความยาวผนัง x ความสูงไปยังงานก่อ/ฉาบ/สี และ count marker ไปยังจำนวนประตูหรือสุขภัณฑ์

---

## 7. AI API Engine Concept

AI ต้องถูกแยกเป็นชั้นกลาง ไม่ควรให้โปรแกรมหลักผูกกับ Custom GPT โดยตรง โครงสร้างที่แนะนำคือ **Desktop App → AI API Engine → Custom GPT/LLM** เพื่อให้ควบคุมข้อมูล ค่าใช้จ่าย prompt version และ business logic ได้ง่ายกว่า เอกสาร OpenAI ระบุว่าการเชื่อม Custom GPT กับระบบภายนอกผ่าน Actions ต้องกำหนดรายละเอียด API, authentication และ OpenAPI schema เพื่อบอกว่า GPT เรียก server ใดและ endpoint ใดได้[1]

| Layer | หน้าที่ | ใช้อินเทอร์เน็ตหรือไม่ |
|---|---|---|
| Desktop Estimating App | เปิดแบบ วัดปริมาณ ทำ BOQ และ export | ไม่จำเป็นสำหรับงานหลัก |
| Local Project Database | เก็บ drawing, measurement, formula, BOQ, AI history | ไม่จำเป็น |
| AI API Engine | รับ request, sanitize data, build prompt, call model, return JSON | ใช้เมื่อเรียก AI |
| Custom GPT/LLM | วิเคราะห์ BOQ, อ่าน snapshot, แนะนำรายการ, ตอบคำถาม | ใช้ internet/cloud |

### 7.1 AI Endpoints สำหรับ MVP

| Endpoint | หน้าที่ | Priority |
|---|---|---|
| `POST /ai/review-boq` | ตรวจ BOQ เทียบกับ measurement และหมวดงาน | สูงมาก |
| `POST /ai/suggest-items` | แนะนำรายการ BOQ จากพื้นที่/วัตถุที่ผู้ใช้วัด | สูงมาก |
| `POST /ai/explain-quantity` | อธิบายว่าปริมาณหนึ่งมาจากอะไร | สูง |
| `POST /ai/read-drawing-text` | OCR/อ่านข้อความจาก crop หรือหน้าแบบ | กลาง |
| `POST /ai/ask-project` | ถามตอบกับข้อมูลโครงการ | Phase ถัดไป |

### 7.2 AI Output Format

AI ไม่ควรส่งกลับเป็นข้อความลอย ๆ เท่านั้น แต่ต้องส่ง structured JSON ที่โปรแกรมนำไปแสดงผลและบันทึกประวัติได้

```json
{
  "suggestions": [
    {
      "type": "missing_item",
      "severity": "medium",
      "target_boq_item_id": null,
      "target_measurement_id": "m_floor_bathroom_001",
      "drawing_page_id": "page_005",
      "title": "อาจขาดรายการกันซึมห้องน้ำ",
      "reason": "พบพื้นที่ห้องน้ำที่มีงานปูกระเบื้อง แต่ยังไม่พบ BOQ งานกันซึมที่สัมพันธ์กัน",
      "suggested_action": "เพิ่ม checklist งานกันซึมหรือสร้าง BOQ item ใหม่",
      "confidence": 0.78,
      "status": "pending_user_review"
    }
  ]
}
```

### 7.3 AI Governance

| หลักการ | รายละเอียด |
|---|---|
| Human-in-the-loop | AI เสนอแนะเท่านั้น ผู้ใช้ต้อง accept/reject |
| Scoped Upload | ส่งเฉพาะหน้า แบบ crop หรือ BOQ rows ที่จำเป็น |
| Audit Log | บันทึกว่า AI วิเคราะห์อะไร เมื่อไร และผู้ใช้ตัดสินใจอย่างไร |
| Model Abstraction | เปลี่ยน Custom GPT/LLM provider ได้โดยไม่กระทบ app หลัก |
| Cost Control | เก็บ usage เพื่อทำ quota, AI credits หรือ subscription plan |
| Privacy | แจ้งผู้ใช้ก่อนส่งข้อมูลออกจากเครื่องเสมอ |

---

## 8. Recommended Data Model

Data model ต้องออกแบบให้ไม่ผูกกับ UI มากเกินไป เพื่อให้ต่อยอดเป็น online, cloud sync หรือ Custom GPT Actions ได้ในอนาคต ข้อมูล geometry ต้องเก็บในรูป structured data และทุก BOQ row ต้อง link กลับไปหา measurement ได้

| Entity | Fields สำคัญ | หมายเหตุ |
|---|---|---|
| Project | id, name, client, created_at, updated_at, settings | หนึ่งไฟล์โครงการมีหลาย drawing pages |
| SourceFile | id, project_id, file_name, file_type, local_path, imported_at | รองรับ PDF/image/CAD ในอนาคต |
| DrawingPage | id, source_file_id, page_number, width_px, height_px, scale | scale อาจต่างกันในแต่ละหน้า |
| Measurement | id, page_id, type, geometry_id, category_id, quantity, unit, label | object หลักของ takeoff |
| Geometry | id, type, points, bounds, coordinate_space | เก็บ point/line/polygon/rect/lasso |
| BOQItem | id, code, description, quantity, unit, unit_price, amount, group | รายการ BOQ |
| MeasurementBOQLink | id, measurement_id, boq_item_id, formula_id, factor | ทำ traceability |
| FormulaTemplate | id, name, input_unit, output_unit, expression, variables | สูตรที่ผู้ใช้แก้ได้ |
| AISuggestion | id, project_id, target_type, target_id, type, reason, confidence, status | บันทึก AI suggestion |
| AuditEvent | id, event_type, actor, timestamp, payload | ใช้ตรวจย้อนหลัง |

### 8.1 ตัวอย่าง Measurement Object

```json
{
  "id": "m_001",
  "page_id": "page_005",
  "type": "polygon_area",
  "category_id": "floor_tile",
  "geometry": {
    "type": "polygon",
    "points": [
      {"x": 120.5, "y": 220.0},
      {"x": 400.2, "y": 220.4},
      {"x": 402.0, "y": 510.8},
      {"x": 121.1, "y": 512.0}
    ],
    "coordinate_space": "page_pixel"
  },
  "quantity": 12.84,
  "unit": "m2",
  "label": "พื้นห้องน้ำชั้น 1",
  "created_by": "user",
  "created_at": "2026-05-21T10:00:00+07:00"
}
```

---

## 9. Suggested Application Modules

ควรแบ่งงานพัฒนาเป็น module เพื่อให้ใช้ Cursor, Claude, Codex หรือ Claude Code ช่วยเขียนทีละส่วนได้โดยไม่ทำให้ระบบบานปลาย

| ลำดับ | Module | Output ที่ต้องได้ | เหตุผลที่ต้องมาก่อน/หลัง |
|---:|---|---|---|
| 1 | Project Shell | สร้าง/เปิด/บันทึก project | เป็นฐานของข้อมูลทั้งหมด |
| 2 | Drawing Importer | import PDF/JPG/PNG และ render หน้าแบบ | ต้องมีก่อน canvas |
| 3 | Canvas Viewer | zoom, pan, thumbnail, page switch | เป็นฐาน interaction |
| 4 | Scale Calibration | กำหนด scale ต่อหน้า | จำเป็นก่อนคำนวณปริมาณจริง |
| 5 | Measurement Tools | line, polyline, polygon, rectangle, count | core value ของโปรแกรม |
| 6 | Measurement Table | แสดง/แก้รายการที่วัดได้ | ทำให้ผู้ใช้ตรวจข้อมูลได้ |
| 7 | Formula & BOQ | map measurement → BOQ | เปลี่ยน takeoff เป็น business value |
| 8 | Export | Excel/PDF report | ใช้ส่งงานจริงได้ |
| 9 | AI API Hook | เรียก AI review/suggest | เพิ่ม intelligence หลัง core นิ่ง |
| 10 | AI Suggestion UI | accept/reject/audit log | ทำให้ AI ใช้งานจริงอย่างปลอดภัย |

---

## 10. Technical Direction เบื้องต้น

ส่วนนี้ไม่บังคับเทคโนโลยี แต่เป็นแนวทางให้ทีมพัฒนาใช้ตัดสินใจ หากต้องการทำ desktop app ที่ต่อยอด online ได้ ควรเลือก stack ที่รองรับ canvas interaction, local storage และ API integration ได้ดี

| ทางเลือก | ข้อดี | ข้อควรระวัง |
|---|---|---|
| Electron + React/TypeScript | UI คล้าย web, ทำ canvas ได้ดี, เชื่อม API ง่าย, ต่อ online ภายหลังง่าย | app size ใหญ่กว่า native |
| Tauri + React/TypeScript | เบากว่า Electron, ใช้ web UI ได้ | บาง integration อาจซับซ้อนกว่า |
| Python + Qt | ทำ desktop ได้ดี, image/PDF processing ง่าย | UI modern และ AI/web integration อาจช้ากว่า |
| Web App + Local-first | ต่อ cloud ง่าย | offline file access และ desktop workflow ต้องออกแบบดี |

ถ้าเป้าหมายคือให้ AI coding tools ช่วยพัฒนาเร็วและต่อยอด cloud ได้ภายหลัง แนวทาง **React/TypeScript + desktop wrapper** จะเหมาะ เพราะ canvas, state management, API client และ UI component ecosystem พร้อมกว่า แต่ต้องออกแบบ project file/local database ให้ดีตั้งแต่แรก

---

## 11. Business Model Concept

โมเดลธุรกิจควรสอดคล้องกับโครงสร้าง offline-first + optional AI เพราะผู้ใช้บางกลุ่มต้องการซื้อโปรแกรมใช้งานในเครื่อง ขณะที่รายได้ระยะยาวควรมาจาก AI, cloud sync และ team collaboration

| ระยะ | รูปแบบรายได้ | สิ่งที่ขาย |
|---|---|---|
| MVP / Early Access | One-time license หรือ annual license | โปรแกรมถอดแบบและ BOQ offline |
| AI Add-on | AI credits หรือ monthly add-on | AI review, suggest items, explain quantity |
| Team Plan | subscription รายทีม | cloud project, collaboration, approval, shared price database |
| Enterprise | custom deployment | private AI/API engine, company template, security, support |

แนวทางที่น่าสนใจคือขาย core app แบบใช้งานได้จริงแม้ไม่จ่ายค่า AI เพิ่ม แล้วให้ AI เป็นตัวเพิ่มมูลค่า เช่น ตรวจ BOQ ได้จำนวนครั้งต่อเดือน หรือซื้อ credit ตาม usage วิธีนี้ทำให้ผู้ใช้เชื่อมั่นว่าโปรแกรมไม่ถูกล็อกด้วยอินเทอร์เน็ต แต่ธุรกิจยังมี recurring revenue จาก AI service

---

## 12. Development Roadmap

| Phase | เป้าหมาย | ฟีเจอร์หลัก | เกณฑ์ผ่าน |
|---|---|---|---|
| Phase 0: Prototype | พิสูจน์ canvas measurement | import image/PDF page, zoom/pan, scale, line/area/count | วัดพื้นที่และ export table ได้ |
| Phase 1: MVP | ใช้งานประมาณราคาเบื้องต้นได้ | project, measurement table, BOQ mapping, Excel export | ทำ BOQ จากแบบตัวอย่างได้ครบ flow |
| Phase 1.5: AI MVP | AI ช่วยตรวจ BOQ ได้ | AI review, suggest item, explain quantity, accept/reject | AI suggestion บันทึกและย้อนดูได้ |
| Phase 2: Advanced Takeoff | เพิ่ม assisted selection | drag select, OCR, region crop, boundary assist | ลดเวลาถอดแบบได้ชัดเจน |
| Phase 3: Online/Cloud | sync และ team workflow | cloud project, user account, sharing, Custom GPT Actions | หลายคนทำงานร่วมกันได้ |
| Phase 4: CAD/BIM | รองรับไฟล์เชิงลึก | DWG/DWF/IFC workflow | ใช้กับงาน professional มากขึ้น |

---

## 13. Acceptance Criteria สำหรับ MVP

MVP จะถือว่าสำเร็จเมื่อผู้ใช้สามารถนำแบบ PDF/JPG/PNG เข้ามา ตั้ง scale วัดปริมาณ สร้าง BOQ และ export รายงานได้ โดย BOQ แต่ละรายการสามารถ trace กลับไปยัง measurement บนแบบได้

| หมวด | Acceptance Criteria |
|---|---|
| Import | เปิด PDF multi-page และ image ได้โดยไม่เสีย layout หลัก |
| Scale | ตั้ง scale ต่อหน้าและคำนวณระยะจริงได้ถูกต้อง |
| Measurement | สร้าง line, polygon area, rectangle area และ count marker ได้ |
| Edit | แก้ label, category, quantity override และลบ measurement ได้ |
| BOQ Link | BOQ row link กลับไป highlight measurement ได้ |
| Export | export Excel ที่มีรายการ BOQ, quantity, unit price, amount ได้ |
| AI Review | ส่งข้อมูล BOQ/measurement ไป AI API Engine และรับ suggestion กลับมาได้ |
| Human Control | AI suggestion ต้อง accept/reject ก่อนจึงเปลี่ยนข้อมูลโครงการ |
| Local Work | หากไม่มี internet ยังเปิดโครงการ วัด และ export ได้ |

---

## 14. Prompt Pack สำหรับส่งให้ Claude/Cursor/Codex

### 14.1 Master Prompt สำหรับเริ่มโปรเจกต์

```text
You are building an offline-first construction estimating desktop application. The core feature is a drawing measurement engine that imports PDF/JPG/PNG drawings, lets users calibrate scale, measure line/polyline/polygon/rectangle/count objects on a canvas, maps measurements to BOQ items through formulas, and later connects to an AI API Engine for BOQ review. Do not implement full AI or CAD native support in the first iteration. Focus on clean architecture, structured data models, and traceability from BOQ rows back to drawing measurements.

Build the app in small modules:
1. Project shell and local storage
2. Drawing importer and page viewer
3. Canvas zoom/pan and page coordinate system
4. Scale calibration
5. Measurement tools
6. Measurement table
7. BOQ mapping and formula engine
8. Export
9. AI API hook and suggestion UI

Every measurement must be stored as structured geometry in page coordinates. Every BOQ item must be traceable to one or more measurements. AI suggestions must never auto-modify BOQ; they must be pending until user accepts or rejects them.
```

### 14.2 Prompt: Canvas Viewer Module

```text
Design and implement the Canvas Viewer module for the estimating app. It must display a rendered drawing page, support zoom, pan, fit-to-screen, and page switching. Use a stable page coordinate system so that measurement geometry is stored in original page pixel coordinates, not screen coordinates. Provide functions to convert screen coordinates to page coordinates and page coordinates to screen coordinates. Do not implement BOQ or AI yet.
```

### 14.3 Prompt: Measurement Tools Module

```text
Implement measurement tools for line, polyline, polygon area, rectangle area, and count marker. Each tool must create a Measurement object with geometry, quantity, unit, label, and category. The polygon tool should allow multiple node clicks and close on double click or Enter. Users must be able to select, move, and delete measurements. Quantities must update when geometry changes. Use the scale factor from the DrawingPage to convert pixel values to real-world units.
```

### 14.4 Prompt: BOQ Mapping Module

```text
Implement a BOQ mapping module. Users can map one or more measurements to a BOQ item using a formula template. BOQ items must include code, description, quantity, unit, unit_price, amount, and links back to source measurement IDs. Clicking a BOQ row should highlight the related measurement geometry on the drawing canvas. Do not lose traceability when exporting.
```

### 14.5 Prompt: AI API Engine Hook

```text
Implement only the client-side hook for AI review. The app should package selected BOQ rows, measurement metadata, drawing page IDs, and optional cropped image references into a structured request to POST /ai/review-boq. The response should be parsed as AI suggestions with type, severity, target IDs, reason, confidence, and suggested_action. Display suggestions in a review panel with Accept and Reject buttons. AI must not directly change the BOQ without user confirmation.
```

---

## 15. Open Questions ก่อนเริ่มเขียนโค้ดจริง

ก่อนเริ่มพัฒนา ควรตกลงประเด็นต่อไปนี้เพื่อไม่ให้ทีมพัฒนาเลือกผิดทางตั้งแต่แรก

| คำถาม | ตัวเลือกที่ต้องตัดสินใจ | ข้อเสนอเบื้องต้น |
|---|---|---|
| Desktop stack | Electron, Tauri, Python Qt, Web local-first | เริ่มจาก React/TypeScript + desktop wrapper |
| Project file | SQLite, JSON bundle, local folder structure | SQLite + asset folder หรือ project bundle |
| PDF rendering | render เป็น image ต่อหน้า หรืออ่าน vector | MVP render เป็น image ก่อน |
| CAD support | native DWG/DWF หรือ convert ก่อน | convert เป็น PDF/image ใน phase แรก |
| AI location | local server หรือ cloud API | เริ่ม cloud AI API Engine แต่ core app offline ได้ |
| Pricing | license, subscription, AI credits | core license + optional AI credits |
| Target user แรก | ผู้รับเหมารายเล็ก, QS, designer | ผู้รับเหมารายเล็ก-กลางที่ต้องทำ BOQ เร็ว |

---

## 16. Final Recommendation

คำแนะนำหลักคือให้เริ่มพัฒนาจาก **Drawing Measurement Engine v1** ก่อน แล้วค่อยต่อ **BOQ Mapping** และ **AI API Engine Hook** ตามลำดับ อย่าเริ่มจาก AI object detection เต็มรูปแบบหรือ DWG/DWF native เพราะจะทำให้ MVP ยากเกินไปและเสี่ยงใช้เวลานานโดยยังไม่ได้พิสูจน์คุณค่าหลัก

ลำดับที่ควรทำทันทีคือหนึ่ง เปิดไฟล์และแสดงแบบบน canvas ให้ดี สอง วัดแบบ node-to-node และ polygon ได้แม่น สาม ผูก measurement เข้า BOQ ได้ สี่ export Excel ได้ และห้าให้ AI ตรวจ BOQ แบบ human-in-the-loop เมื่อ core workflow ใช้งานได้แล้ว

> **หลักตัดสินใจ:** ถ้าฟีเจอร์ใดไม่ช่วยให้ BOQ ตรวจย้อนกลับได้ ไม่ลดรายการตกหล่น และไม่ช่วยให้ผู้รับเหมาปิดราคาได้มั่นใจขึ้น ควรเลื่อนไป phase ถัดไป

---

## References

[1]: https://developers.openai.com/actions/ "OpenAI Developers: GPT Actions / Actions Documentation"
[2]: https://www.autodesk.com/blogs/construction/quantity-takeoffs/ "Autodesk Construction Blog: Quantity Takeoffs"
