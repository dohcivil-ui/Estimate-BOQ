# CLAUDE.md — Estimate-BOQ v2 (Track B / AI-first)

> Claude Code อ่านไฟล์นี้อัตโนมัติทุก session — เป็น **single source of truth สำหรับโฟลเดอร์ `estimate-boq-v2/` เท่านั้น**
> รากของ repo มี Track A (`../CLAUDE.md`, `../prompt.md`, `../src/`) ที่ใช้กฎคนละชุด **อย่าเอามาผสม**
> งานพัฒนาทำตาม `../HANDOFF-v2.md` ส่วน 5 (Step 2.0 → 2.9) ทีละ step ห้ามข้าม

---

## 0. Track B vs Track A — ห้ามสับสน

| หัวข้อ | Track A (root `src/`) | **Track B (this folder)** |
|---|---|---|
| ปรัชญา | Drawing Measurement Engine — วัดด้วยมือเป็นหลัก | **AI-first** — Claude วิเคราะห์ก่อน คนตรวจทีหลัง |
| Offline | บังคับ offline-first (IndexedDB) | **Online-first** (Supabase) แต่ degrade ได้ถ้าเน็ตล่ม |
| AI | mock เท่านั้น ห้ามแก้ BOQ เอง | **เรียก Claude Sonnet จริง** ผ่าน Edge Function |
| Auth | ไม่มี (offline) | **Google OAuth** + RBAC (admin/user) |
| Cloud | ห้าม | **Supabase** (Auth + Postgres + Storage + Edge Functions) |
| Styling | inline / vanilla CSS | **Tailwind CSS 3** (dark mode + Sarabun) |
| Storage | IndexedDB | **Postgres + Supabase Storage** |
| Export | xlsx (SheetJS) | **xlsx-js-style** (มีเส้นตาราง) + print PDF |
| Math core | pure TS + Vitest บังคับ | **port มาจาก Track A** เมื่อพร้อม (Step 2.4) — ห้ามคำนวณซ้ำ |

---

## 1. Golden Rules (ห้ามผิดเด็ดขาด)

1. **Human-in-the-loop เป็นกฎสูงสุด** — AI วิเคราะห์/แนะนำได้ แต่ **ห้ามแก้ BOQ เองโดยไม่ผ่านการกด accept** ของผู้ใช้ ผลลัพธ์จาก AI ทุกชิ้นเข้า panel "ผลวิเคราะห์ AI" รอผู้ใช้ตรวจก่อน
2. **Secrets ห้ามหลุดมา frontend** — `ANTHROPIC_API_KEY` / service-role key อยู่ Supabase secret เท่านั้น เรียกผ่าน Edge Function (`supabase.functions.invoke()`) ฝั่ง browser ใช้ **anon key + RLS** ป้องกัน
3. **RLS เป็นชั้นป้องกันสุดท้าย** — RBAC ใน UI เป็น UX guardrail เฉยๆ ของจริงต้องผ่าน **Postgres Row-Level Security** ทุก table ต้องมี RLS policy ครบก่อน production
4. **ภาษาไทยทั้ง UI/error/log** — ผู้ใช้คือวิศวกรไทย คำผิดศัพท์เทคนิคห้าม (ฐานราก/เสา/คาน/พื้น/คอนกรีต/เหล็กเสริม ฯลฯ ใช้ภาษาไทยตรง spec)
5. **ค่าแรง ว.809 = ฐาน, ราคาวัสดุ = ไกด์** — hardcode ค่าตาม `../HANDOFF-v2.md` + `../PROMPT-Claude-Code-Phase2.md` แต่ **ทุกค่าต้องแก้ได้** ใน UI (ค่าแรงเป็น default, ผู้ใช้ override ได้ต่อโปรเจกต์)
6. **Traceability** — ทุก BOQ row ต้องชี้กลับได้ว่า "มาจากไหน": `source: 'ai' | 'manual' | 'measurement'` + `source_ref` (ai_analysis_id, shape_id, ฯลฯ) ห้ามมี row ลอย
7. **AI fail ต้องไม่ทำ app พัง** — Edge Function timeout/error → แสดง error ใน AI panel เท่านั้น ส่วนอื่นของ app ใช้งานต่อได้ปกติ (เครื่องมือวัดมือ + BOQ manual)
8. **Schema migration ต้องเป็นไฟล์** — แก้ schema ผ่าน `supabase/migrations/*.sql` เท่านั้น ห้ามแก้ผ่าน dashboard แล้วลืม commit

> ถ้างานจะกระทบ Golden Rule ข้อใด **หยุดแล้วถามผู้ใช้ก่อน**

---

## 2. Stack (ตัดสินใจแล้ว ห้ามเปลี่ยน)

| Layer | เลือกใช้ | หมายเหตุ |
|---|---|---|
| Build/UI | React 18 + TypeScript (strict) + Vite 5 | `@/*` alias → `src/*` |
| Styling | Tailwind CSS 3 (dark mode class) | ฟอนต์ Sarabun preload ใน `index.html` |
| Canvas | Konva + react-konva | background raster + vector overlay |
| State | Zustand | stores แยกตาม domain |
| PDF | pdfjs-dist 4.x | render หน้าเป็น image |
| Backend | Supabase (Auth + Postgres + Storage + Edge Functions) | self-hosted ได้ทีหลัง |
| Auth | Supabase Auth — Google OAuth | (Facebook เพิ่มทีหลัง) |
| AI | Claude Sonnet 4 ผ่าน Edge Function | **frontend ห้ามเรียก Anthropic ตรง** |
| Export | xlsx-js-style (Excel มีเส้น) + browser print (PDF) | จะพิจารณาเปลี่ยนเป็น exceljs ตอน 2.4 |
| Lint/Format | ESLint 9 flat config + Prettier 3 | husky pre-commit gate |

---

## 3. โครงสร้างเป้าหมาย

```
estimate-boq-v2/
├─ CLAUDE.md                      ← ไฟล์นี้
├─ README.md                       ← roadmap + วิธีใช้
├─ docs/
│  └─ SUPABASE_SETUP.md            ← คู่มือสร้าง Supabase project + Google OAuth
├─ supabase/
│  ├─ migrations/*.sql             ← schema + RLS + triggers (source of truth)
│  └─ functions/                   ← Edge Functions (เพิ่ม Step 2.5)
├─ src/
│  ├─ App.tsx + main.tsx
│  ├─ components/                  ← UI ทุก panel
│  ├─ stores/                      ← zustand: auth, drawing, boq, ai, ui
│  ├─ lib/
│  │  └─ supabase.ts               ← client + helpers
│  ├─ services/                    ← เรียก Edge Function, export, persistence
│  ├─ types/                       ← User, Project, Drawing, BOQ, Shape, AIAnalysis
│  └─ index.css                    ← Tailwind base + scrollbar
├─ index.html · vite.config.ts · tsconfig*.json
├─ tailwind.config.js · postcss.config.js
├─ eslint.config.js · .prettierrc.json
└─ .env.example                    ← VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
```

---

## 4. Roadmap (Step 2.0 → 2.9 ดู ../HANDOFF-v2.md ส่วน 5)

- [x] **2.0** Scaffold + layout 3 panel + Supabase client guard
- [ ] **2.1** Auth (Google OAuth) + RBAC admin/user + RLS schema + ESLint/Prettier/husky
- [ ] 2.2 Drawing Viewer — PDF/JPG + zoom/pan/thumbnail (react-konva + pdfjs)
- [ ] 2.3 Measurement Tools — scale/length/area/count + snap + ortho + rotate (port จาก Track A)
- [ ] 2.4 BOQ Engine — ค่าแรง ว.809 + ราคาวัสดุ + Factor F + Excel/PDF export
- [ ] 2.5 **AI Analysis** — Edge Function → Claude Sonnet → review panel
- [ ] 2.6 Cloud Storage — projects/shapes/boq บน Supabase + auto-save
- [ ] 2.7 Custom GPT Actions (REST endpoint)
- [ ] 2.8 Admin Panel — จัดการ user + อนุมัติ delete requests
- [ ] 2.9 ราคา สนค. รายจังหวัด (scheduled scraper)

---

## 5. Commands

```bash
cd estimate-boq-v2
npm install
cp .env.example .env.local         # เติมค่าจริง — ดู docs/SUPABASE_SETUP.md
npm run dev                         # http://localhost:5173
npm run typecheck                   # tsc -b --noEmit
npm run lint                        # eslint
npm run format                      # prettier --write
npm run build                       # tsc + vite build
```

## 6. Workflow

- ทำตาม `../HANDOFF-v2.md` ส่วน 5 **ทีละ step** จบแล้วหยุดรายงาน + วิธีทดสอบด้วยมือ ก่อนไปต่อ
- ก่อน commit: husky pre-commit รัน `typecheck + lint` ของ Track B (+ test:math ของ Track A ถ้าแตะ root `src/`)
- รูปแบบรายงานจุดหยุด (เหมือน Track A):
  ```
  ## Step 2.x รายงานผล
  - ทำอะไร (ไฟล์ที่แตะ) / typecheck / lint / test ผ่านกี่ชุด
  - demo ที่ทำได้ + วิธีทดสอบด้วยมือ
  - Golden Rule ใดที่เสี่ยง / RLS policy ใหม่ที่เพิ่ม
  - รอไฟเขียวก่อนไป step ถัดไป
  ```

## 7. ห้ามทำ (out of MVP)

- DWG/DWF native (ให้ผู้ใช้ export PDF เอง)
- Real-time collaboration (Step 2.6 เก็บไว้คนเดียวก่อน)
- BIM/IFC
- Mobile app
- Multi-tenant org (ตอนนี้ user ↔ projects เป็น 1:N เท่านั้น)
- Payment/subscription
- ทำเลย **ANTHROPIC_API_KEY ใน frontend** (= security incident)
