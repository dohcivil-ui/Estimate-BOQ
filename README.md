# Estimate-BOQ — Drawing Measurement Engine (web-first MVP)

โปรแกรมถอดแบบ & ประมาณราคาก่อสร้าง offline-first พร้อม traceable BOQ และ AI ช่วยตรวจ (human-in-the-loop)

> เอกสาร: `CLAUDE.md` (กฎ + stack), `prompt.md` (แผน 5 phase), `docs/` (Brief + spec + reference prototype)

## เริ่มต้น (bootstrap)

ทำใน **Git Bash** ที่ root ของ repo:

```bash
npm install
npx husky init
chmod +x .husky/pre-commit
```

> ตอนนี้ src/core/*.ts เป็น stub (throw not implemented) คู่กับ *.test.ts ที่มีค่าถูกต้องแล้ว
> `npm run test:math` จะ "แดง" จนกว่า Claude Code ทำ Phase 2 (เขียน implementation) — เป็นเรื่องปกติ

## เริ่มเขียนโค้ดด้วย Claude Code

```bash
claude
```
แล้วพิมพ์: **"อ่าน prompt.md แล้วเริ่ม Phase 0 ตามนั้น"**
Claude Code จะอ่าน CLAUDE.md เอง ทำทีละ phase แล้วหยุดรายงานก่อนไป phase ถัดไป

## คำสั่ง

```bash
npm run dev          # vite dev
npm run test:math    # เทสต์คณิตศาสตร์ (ผิดไม่ได้)
npm run test         # เทสต์ทั้งหมด
npm run typecheck
```

## แผน 5 phase (ดู prompt.md)

- P0 Scaffold → P1 เห็นแบบ (viewer+thumbnail+zoom/pan) → P2 เลขเชื่อถือได้ (core math+scale)
- P3 วัดได้จริง (tools+edit+table) → P4 ผูกราคา (BOQ+save+export) → P5 AI ช่วยตรวจ (mock)

## สถานะ

- [x] rails: CLAUDE.md, prompt.md, docs, src/core stub+tests, husky gate
- [ ] P0–P5 ตาม prompt.md
