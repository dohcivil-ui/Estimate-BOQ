# 📋 HANDOFF v2 — โปรเจกต์โปรแกรมประมาณราคาก่อสร้าง

> อัปเดต: 26 พ.ค. 2569 (เย็น)
> แนบไฟล์นี้ + ไฟล์โปรแกรม + ไฟล์แบบทดสอบ แล้วบอก Claude Code ว่า
> "อ่าน HANDOFF แล้วเริ่ม Phase 2"

---

## 🟢 สถานะล่าสุด (26 พ.ค. 2569 เย็น)

> Phase 2 (Web App) สร้างเสร็จแล้วใน `estimate-boq-v2/` — รายละเอียดดู `estimate-boq-v2/CLAUDE.md`

### ✅ งานที่เสร็จแล้ว
- **ฝัง Steel Properties** — 131+128 sections (Lip Channel / Angle / H-Beam / Square Pipe) + สูตรน้ำหนัก 7 สูตร + SS400 245 MPa
- **ทดสอบ AI accuracy** — Structural ≥93% / Architectural ≥85% + กฎ 5-12 (open-structure, มิติ cross-check, วัสดุมุงหลังคา, confidence taxonomy, นับฐาน/เสาจาก grid)
- **HD resolution** — default 3000px / HD 4000px

### ⬜ งานที่เหลือ
1. **ปรับปรุง Canvas** (snap / measure / UI) — อ้างอิง style จาก changkid-engapp
2. **Deploy production** → `/estimate/` บน doh-thai.com (HestiaCP VPS)

---

## 1) ภาพรวมโปรเจกต์

ผู้ใช้เป็น **วิศวกรโยธา จ.หนองคาย** กำลังสร้างเครื่องมือ **ประมาณราคางานก่อสร้าง** จากแบบ (JPG/PNG/PDF)
อ้างอิงบัญชีค่าแรง **ว.809 (14 พ.ย. 2568) กรมบัญชีกลาง** สื่อสารเป็นภาษาไทย

**ปรัชญา:** เริ่มจาก standalone → ตอนนี้พร้อมขยายเป็น Web App + AI

---

## 2) สิ่งที่ทำเสร็จแล้ว (Phase 0+1)

### ไฟล์ทั้งหมด (ล่าสุด)

| ไฟล์ | หน้าที่ | สถานะ |
|------|---------|-------|
| **cost-estimator-v2.html** | โปรแกรมหลัก (single-file HTML) | ✅ Phase 1 ครบ + bug fix |
| **ฐานความรู้-ถอดปริมาณครบทุกหมวด.md** | Knowledge สำหรับ Custom GPT | ✅ เพิ่มตัวอย่างเสา/คาน/พื้น/บันได |
| **Custom-GPT-Instructions.txt** | Instructions วางใน Custom GPT | ✅ รองรับ 📋 ส่ง/🤖 รับ JSON |
| **Custom-GPT-ตั้งค่า.md** | คู่มือสร้าง Custom GPT | ✅ |
| **งานB-ทดสอบ-Workflow.html** | Checklist ทดสอบ (ติ๊กได้) | ✅ ทดสอบแล้ว |
| **BOQ-อาคารฟอกไตเทียม.json** | ตัวอย่าง JSON นำเข้า BOQ | ✅ |
| **ราคาวัสดุ-ไกด์รายจังหวัด-template.csv** | ตารางราคาไกด์ | template |

### งาน A — เพิ่มตัวอย่างถอดปริมาณ ✅ เสร็จ

เพิ่ม worked examples 4 รายการในฐานความรู้ GPT (ส่วนที่ 3):
- 3.2 เสา C1 (0.20×0.30, 4-DB16, ปลอก RB6@0.20)
- 3.3 คาน B1 (0.20×0.40, บน+ล่าง 2-DB16, ปลอก RB6@0.20)
- 3.4 พื้น S1 (4×5 ม., หนา 0.12, DB12@0.20 + DB10@0.20)
- 3.5 บันได ST1 (กว้าง 1.20, 10 ขั้น, ลูกตั้ง 0.175, ลูกนอน 0.25)

### งาน B — ทดสอบ Workflow จริง ✅ เสร็จ

ทดสอบกับ **แบบอาคารฟอกไตเทียม โรงพยาบาลสุมาลย์** (28 แผ่น: A×13 + S×9 + EE×3 + SN×4)

**ผลทดสอบ: 5/10 ผ่าน**

| # | รายการ | ผล | หมายเหตุ |
|---|--------|-----|---------|
| 1 | เปิด PDF + ตั้งสเกล | ✅ | |
| 2 | วัดพื้นที่อาคาร ~364 ตร.ม. | ❌ | ได้ 373 (แบบเอียง) |
| 3 | วัดเส้นรอบรูปผนังนอก ~80 ม. | ❌ | ได้ 82.32 (แบบเอียง) |
| 4 | นับเสา C1 ~35 จุด | ❌ | จริง F1C1=30, F1C3=4 |
| 5 | 📋 ส่งออกค่าวัดไป GPT | ✅ | |
| 6 | GPT คำนวณ + ส่ง JSON | ❌ | GPT ถามมากเกินไป |
| 7 | 🤖 นำเข้า JSON เข้า BOQ | ✅ | |
| 8 | ราคากลาง Factor F | ✅ | |
| 9 | Export Excel/PDF | ✅ | ไม่มีเส้นตาราง (แก้แล้ว) |
| 10 | Save/Load | ❌ | PDF กลับแค่โครงร่าง (แก้แล้ว) |

### Bug ที่แก้แล้ว (ในรอบนี้)

| Bug | แก้ไข |
|-----|-------|
| Save/Load PDF ได้แค่โครงร่าง | บันทึกหน้า PDF เป็น data URL ก่อน save |
| Excel ไม่มีเส้นตาราง | เปลี่ยนเป็น xlsx-js-style + เพิ่ม border/header style |
| แบบเอียง Ortho เพี้ยน | เพิ่มปุ่มหมุน ±0.1°/±1° + 🤖 auto-deskew (Sobel edge) |

### ฟีเจอร์ที่เพิ่มใหม่ (ในรอบนี้)

| ฟีเจอร์ | คำอธิบาย |
|---------|---------|
| 🤖 นำเข้าจาก AI | ปุ่มในแท็บ BOQ → modal วาง JSON → นำเข้า BOQ อัตโนมัติ |
| 📋 ส่งออกค่าวัดไป GPT | ปุ่มในแท็บ วาด/วัด → รวมค่าวัดเป็นข้อความ + คัดลอก |
| 🔄 หมุนภาพ + Auto-deskew | ปุ่ม ±0.1°/±1° + ตรวจจับเอียงอัตโนมัติ (Sobel) |
| 🗑️ ล้าง BOQ | ปุ่มลบ BOQ ทั้งหมด |

---

## 3) ความสามารถปัจจุบันของ cost-estimator-v2.html

**เปิดไฟล์:** JPG, PNG, PDF (เลือกหน้า + DPI)
**เครื่องมือ:** ⬡พื้นที่ · 📏ความยาว · ⭕วงกลม · 🔢นับจำนวน · 📐ตั้งสเกล · 🖱️เลือก
**Snap (F3):** ●ปลาย ▲กลาง ✕จุดตัด ⊾ตั้งฉาก ◇บนเส้น + ✛Snap เส้นในแบบ
**Ortho:** Shift/F8 · **หมุนภาพ:** ±0.1°/±1°/🤖auto-deskew
**แก้ไข:** ลากย้าย vertex · dbl-click แทรก · คลิกขวาลบ · Ctrl+D คัดลอก · ✎ ตั้งชื่อ
**Layer:** หลายชั้นงาน · **สรุป:** กลุ่มตามชื่อ
**BOQ:** ค่าแรง(ว.809)/วัสดุ · ปริมาณ · ความหนา · เผื่อเสีย% · Factor F → ราคากลาง
**AI เชื่อม:** 📋 ส่งค่าวัดไป GPT → 🤖 นำเข้า JSON จาก GPT
**Export:** Excel (มีเส้นตาราง), CSV, PDF
**Save/Load:** JSON (รวมภาพ PDF + shapes + BOQ + rotation)

**State หลัก:** `tool, shapes[], boq[], sc, layers[], activeLayer, factorF, imgRot, snapImg, imgData`
**CDN:** Sarabun, xlsx-js-style 1.2.0, PDF.js 3.11.174

---

## 4) ฝั่ง AI — Custom GPT

- Instructions: รองรับรับ-ส่งข้อมูลกับโปรแกรม (📋 ส่ง / 🤖 JSON กลับ)
- Knowledge: ฐานความรู้ครบทุกหมวด + ตัวอย่าง 5 องค์ประกอบ + ว.809 + ราคาไกด์
- Capabilities: ✅ Code Interpreter + ✅ Web Search

**ปัญหาที่พบจากการทดสอบ:**
- GPT ถามยืนยันมากเกินไป ต้องให้ผู้ใช้หาข้อมูลมาเอง
- ผู้ใช้ต้องการ: **AI วิเคราะห์แบบในโปรแกรมก่อน** แล้วค่อยส่งข้อมูลที่ครบไป GPT
- ⚠️ ทำได้จริงเมื่อมี backend เท่านั้น → **เป็นเหตุผลหลักที่ต้องทำ Phase 2**

---

## 5) Phase 2 — Web App (งานหลัก)

### สถาปัตยกรรม

```
Frontend (React + Vite)          Backend (Supabase)
━━━━━━━━━━━━━━━━━━━━━━━          ━━━━━━━━━━━━━━━━━━━━
Drawing Viewer + Tools    ←→    PostgreSQL (projects, boq, shapes, users)
AI Analysis Panel         ←→    Edge Functions (Claude API / OpenAI API)
BOQ + Export              ←→    Storage (แบบ PDF/JPG)
Auth (Google/Facebook)    ←→    Supabase Auth
Admin Panel               ←→    RBAC (admin vs user)
```

### ฟีเจอร์ที่ต้องมี (เรียงลำดับสำคัญ)

#### ⭐ ความสำคัญสูงสุด — AI วิเคราะห์แบบ
- ผู้ใช้เปิดแบบ → กดปุ่ม "🤖 AI วิเคราะห์แบบ"
- Backend ส่งภาพไป Claude Sonnet API
- Claude วิเคราะห์: สำรวจองค์ประกอบ (ฐาน/เสา/คาน/พื้น ขนาด/จำนวน/เหล็กเสริม)
- แสดงผลใน panel ให้ผู้ใช้ตรวจ/แก้ไข
- ผู้ใช้ยืนยัน → ส่งข้อมูลครบไป Custom GPT (หรือคำนวณเองใน backend)
- GPT ไม่ต้องถามซ้ำ → ส่ง JSON กลับ → นำเข้า BOQ

#### สำคัญรอง
| ฟีเจอร์ | คำอธิบาย |
|---------|---------|
| Auth | Google/Facebook OAuth (Supabase Auth) |
| RBAC | Admin (ทำทุกอย่าง) vs User (ลบไม่ได้ → ส่งคำขอลบให้ admin) |
| Cloud Storage | แบบ PDF/โปรเจกต์เก็บบน cloud |
| GPT Actions | Custom GPT เรียก API backend ส่ง BOQ เข้าระบบกลาง |
| ดึงราคา สนค. | scheduled job ดึงราคาวัสดุรายจังหวัด (index.tpso.go.th) |
| Multi-user | หลายคนทำงานในโปรเจกต์เดียวกัน |

### Stack ที่แนะนำ

| Layer | เทคโนโลยี | เหตุผล |
|-------|-----------|--------|
| Frontend | React + Vite + TypeScript | ย้าย logic จาก HTML เดิมได้ |
| State | Zustand | เบา + ใช้ง่าย |
| Canvas | react-konva หรือ Fabric.js | ดีกว่า raw canvas |
| PDF | pdfjs-dist | ใช้อยู่แล้ว |
| Backend | Supabase | Auth + DB + Storage + Edge Functions ฟรี |
| DB | PostgreSQL (Supabase) | ตาราง: users, projects, boq_items, shapes, material_prices, delete_requests |
| AI API | Claude Sonnet (Anthropic) | เรียกผ่าน Edge Function |
| Hosting | Vercel (frontend) + Supabase (backend) | มี free tier |

### ตาราง DB (เบื้องต้น)

```sql
users          (id, email, name, role, avatar_url, created_at)
projects       (id, user_id, name, owner, location, factor_f, created_at)
drawing_pages  (id, project_id, page_num, image_url, scale, rotation)
shapes         (id, project_id, page_id, type, name, points_json, area, length, count, layer)
boq_items      (id, project_id, name, unit, rate, qty, is_mat, thick, waste, source)
ai_analyses    (id, project_id, page_id, prompt, response_json, status, created_at)
material_prices(id, province, item, unit, price, source, fetched_at)
delete_requests(id, user_id, item_type, item_id, reason, status, created_at)
```

### ลำดับการพัฒนา Phase 2

| Step | งาน | ประมาณ |
|------|-----|--------|
| 2.0 | Scaffold: Vite + React + TS + Supabase + Zustand | 1 วัน |
| 2.1 | Auth: Google/Facebook login + RBAC | 1 วัน |
| 2.2 | Drawing Viewer: เปิด PDF/JPG + zoom/pan + thumbnail | 2 วัน |
| 2.3 | Measurement Tools: ย้ายจาก HTML เดิม (วัด/วาด/snap/ortho) | 3 วัน |
| 2.4 | BOQ: ย้ายจาก HTML เดิม (ค่าแรง/วัสดุ/Factor F/export) | 2 วัน |
| 2.5 | **AI Analysis**: Edge Function → Claude API → review panel | 2 วัน |
| 2.6 | Cloud Storage: บันทึก/โหลดจาก Supabase | 1 วัน |
| 2.7 | GPT Actions: Custom GPT เรียก API backend | 1 วัน |
| 2.8 | Admin Panel: จัดการ user + อนุมัติลบ | 1 วัน |
| 2.9 | ราคา สนค.: scheduled scraper | 1 วัน |

---

## 6) แบบทดสอบที่มี

อาคารฟอกไตเทียม โรงพยาบาลสุมาลย์ อ.กุสุมาลย์ จ.สกลนคร (28 แผ่น):
- `hemodyalysis_Architec.pdf` — สถาปัตย์ A-01 ถึง A-13
- `hemodyalysis_Structure.pdf` — โครงสร้าง S-01 ถึง S-09
- `hemodyalysis_Electric_and_Sanitary_.pdf` — ไฟฟ้า EE-01~02 + สุขาภิบาล SN-01~04

ข้อมูลที่ถอดได้จากการทดสอบ:
- อาคาร 26×14 ม. ชั้นเดียว สเกล 1:125
- F1C1 = 30 ฐาน, F1C3 = 4 ฐาน (ฐาน 1.50×1.50 + 1.10×1.10)
- เสา C1 = 0.25×0.25 ม. (4-DB20, ปลอก 2ปRB9@0.20)
- คาน B1 = 0.25×0.60 ม. (5-DB20 บน+ล่าง, 3-DB16 ข้าง, ปลอก 1ปRB9@0.10)
- พื้น PS สำเร็จรูป หนา 0.14 ม. (DB12@0.20 ทั้ง 2 ทาง)
- โครงหลังคาเหล็ก: RB □-150×75×20×3.2, แป □-100×50×20×2.3 @1.00 ม.

---

## 7) ข้อตกลง/หลักการ

- ภาษาไทยทั้งหมด, UI theme เข้ม, ฟอนต์ Sarabun
- ราคาวัสดุ = ไกด์ที่แก้ได้ (ไม่ตายตัว)
- AI ใช้ช่วยร่าง ต้องมีคนตรวจ + ระบบถามยืนยัน (human-in-the-loop)
- ค่าแรง ว.809 เป็นฐาน (ปรับได้)
- ราคาจริงรายจังหวัด: สนค. index.tpso.go.th + VAT 7% + ขนส่ง
- แหล่งทางการ: สำนักงานนโยบายและยุทธศาสตร์การค้า (สนค.) กระทรวงพาณิชย์

---

## 8) วิธีเริ่ม Phase 2 ใน Claude Code

```bash
# 1. สร้างโฟลเดอร์โปรเจกต์
mkdir estimate-boq-v2 && cd estimate-boq-v2

# 2. เปิด Claude Code
claude

# 3. พิมพ์:
"อ่าน HANDOFF-v2 แล้วเริ่ม Phase 2 Step 2.0 — Scaffold"
```

Claude Code จะ:
1. อ่าน HANDOFF นี้
2. สร้าง Vite + React + TypeScript + Supabase + Zustand
3. ทำทีละ Step → หยุดรายงาน → รอไฟเขียว

---

## 9) แผนผัง Workflow เป้าหมาย Phase 2

```
ผู้ใช้เปิดแบบ PDF/JPG
     ↓
Drawing Viewer (zoom/pan/thumbnail)
     ↓
กด "🤖 AI วิเคราะห์แบบ"
     ↓
Backend → Claude Sonnet API → วิเคราะห์ภาพ
     ↓
แสดงผล: "พบ F1 30 ฐาน, C1 0.25×0.25 30 ต้น, B1 0.25×0.60..."
     ↓
ผู้ใช้ตรวจ/แก้ไข/ยืนยัน
     ↓
วัดเพิ่มด้วยเครื่องมือ (พื้นที่/ความยาว/นับ)
     ↓
กด "📋 ส่งไป Custom GPT" → ข้อมูลครบ GPT ไม่ต้องถามซ้ำ
     ↓
GPT คำนวณ → ส่งออก JSON
     ↓
กด "🤖 นำเข้า JSON" → BOQ ครบ
     ↓
Export Excel/PDF → ส่งเจ้าของโครงการ
```
