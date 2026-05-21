# CLAUDE.md — Estimate-BOQ / Drawing Measurement Engine

> Claude Code อ่านไฟล์นี้อัตโนมัติทุก session — เป็น single source of truth
> งานพัฒนาทำตาม `prompt.md` (แผน 5 phase) ทีละ phase ห้ามข้าม
> สเปกเต็ม: `docs/Drawing_Measurement_Engine_Specification_v1_0.md` (สเปกหลัก) และ `docs/Development_Brief.md` (ภาพรวม product)

---

## 0. Golden Rules (ห้ามผิดเด็ดขาด)

1. **Page-coordinate เท่านั้น** — geometry ของ measurement เก็บเป็น page/image pixel ของหน้าแบบต้นฉบับ ไม่ใช่ screen coordinate (spec §5.1) แปลงพิกัดผ่าน `src/core/coords.ts` ที่เดียว
2. **Hit testing ทำใน screen coordinate** — เพื่อให้ hit radius คงที่ตอน zoom (spec §10) แต่ "เก็บ" geometry เป็น page coordinate เสมอ
3. **คณิตศาสตร์เป็น pure function** — scale / geometry / formula อยู่ใน `src/core/` เป็น pure TS ห้าม import React/Konva + ต้องมี unit test (spec §16)
4. **Traceability** — BOQ ทุกบรรทัด trace กลับ measurement ได้ (sourceMeasurementIds ไม่ว่าง) (spec §17)
5. **Human-in-the-loop** — AI เสนอแนะเท่านั้น ห้ามแก้ BOQ เอง suggestion = pending จน accept/reject
6. **Offline-first** — เปิดแบบ/วัด/ทำ BOQ/save/export ต้องทำงานได้ไม่มีเน็ต ยกเว้น AI
7. **อย่าทำเกิน MVP** — ห้าม DWG/DWF native, auto-takeoff, BIM, real-time collab, login, cloud, **Electron packaging** (ทำ web ก่อน ห่อ desktop เป็นเฟสถัดไป)

> ถ้างานจะกระทบ Golden Rule ข้อใด หยุดแล้วถามที่ปรึกษา (มนุษย์) ก่อน

---

## 1. Stack (ตัดสินใจแล้ว — web-first MVP)

| ชั้น | เลือกใช้ | หมายเหตุ |
|---|---|---|
| Build/UI | **React + TypeScript (strict) + Vite** | web ก่อน ตาม spec §18 |
| Canvas | **Konva (react-konva)** | background raster + vector overlay (spec §3.1) |
| State | **Zustand** | stores แยกตาม domain; activePageId เป็น single source of truth |
| Persistence | **IndexedDB** (web MVP) | offline; ย้ายเป็น SQLite ตอนห่อ Electron ภายหลัง |
| PDF | **pdfjs-dist** | render หน้าเป็น image @2x |
| Excel | **SheetJS (xlsx)** | export BOQ + Measurements |
| Test | **Vitest** | บังคับสำหรับ src/core |
| Lint/Format | ESLint + Prettier | husky ช่วย format + gate |

> หมายเหตุ: stack นี้เป็น **web** ตั้งใจไม่ใช้ Electron/SQLite ในรอบนี้ เพื่อให้ตรง spec ของ Measurement Engine v1 การห่อ desktop + SQLite เป็นเฟสหลัง Engine v1 เสร็จ

---

## 2. โครงสร้าง repo (เป้าหมาย)

```
.
├─ CLAUDE.md
├─ prompt.md                 ← แผน 5 phase สำหรับ Claude Code
├─ docs/
│  ├─ Development_Brief.md
│  ├─ Drawing_Measurement_Engine_Specification_v1_0.md
│  └─ reference-prototype.html   ← prototype เดิม (อ้างอิงพฤติกรรม UI เท่านั้น)
├─ src/
│  ├─ core/                  ← PURE math + tests (หัวใจความถูกต้อง)
│  │  ├─ coords.ts  scale.ts  geometry.ts  formula.ts
│  │  └─ *.test.ts           ← seed tests (ค่าถูกต้องเขียนไว้แล้ว — ทำให้ผ่าน ห้ามแก้ค่า)
│  ├─ types/                 ← data model จาก spec §5,§8
│  ├─ stores/                ← zustand
│  ├─ canvas/                ← Konva viewer + measurement tools
│  ├─ panels/                ← measurement table, BOQ, AI suggestions
│  └─ ai/                    ← AI hook (mock)
├─ index.html  vite.config.ts  tsconfig.json  package.json
└─ .husky/pre-commit         ← gate: typecheck + test:math
```

---

## 3. คณิตศาสตร์ที่ "ผิดไม่ได้" (มี seed test กำกับใน src/core)

- **scale:** unitPerPixel = realDistance / pixelDistance; pixelPerUnit = ส่วนกลับ (spec §5.2)
- **length:** meters = pixelLength × unitPerPixel
- **area:** shoelace → px² แล้ว m² = areaPx² × unitPerPixel² (ยกกำลังสอง!)
- **coords:** screen↔stage↔page ไป-กลับได้จุดเดิม (round-trip) ตาม ViewTransform
- **formula:** line/polyline/polygon/rect/count → quantity ตามหน่วย

> ห้ามแก้ค่าใน `src/core/*.test.ts` (ค่าที่ที่ปรึกษาวิศวกรรมยืนยันแล้ว) ถ้าคิดว่าเทสต์ผิด หยุดถามก่อน

---

## 4. Commands

```bash
npm run dev          # vite dev server
npm run typecheck    # tsc --noEmit
npm run test         # vitest run (ทั้งหมด)
npm run test:math    # vitest run src/core (เฉพาะคณิตศาสตร์)
npm run lint:fix
npm run build
```

## 5. Workflow

- ทำตาม `prompt.md` ทีละ phase (P1→P5) จบแต่ละ phase หยุดรายงาน + วิธีทดสอบด้วยมือ ก่อนไปต่อ
- หลังแก้ไฟล์: prettier format อัตโนมัติ (husky)
- ก่อน commit: `.husky/pre-commit` รัน typecheck + test:math — ไม่ผ่าน commit ไม่ได้
- ห้าม `git commit --no-verify`
