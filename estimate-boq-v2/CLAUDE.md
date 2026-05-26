# CLAUDE.md — Estimate-BOQ v2

## โปรเจกต์
โปรแกรมประมาณราคาก่อสร้าง (Construction Cost Estimation) สำหรับวิศวกรโยธาไทย
- **Stack**: React 18 + Vite + TypeScript + Supabase + Zustand + react-konva
- **UI**: ภาษาไทย, dark theme, font Sarabun
- **Working dir**: `D:\BOQ Estimate\estimate-boq-v2`

## สถานะปัจจุบัน
- Phase 2 เสร็จครบ: AI 5 engines, 4 mode (สถาปัตย์/โครงสร้าง/ไฟฟ้า/สุขาภิบาล)
- AI engines: Claude Sonnet 4.6 + GPT-5.4 + GPT-4.1 Mini (OpenRouter) + Gemini 2.5 Pro + Flash (Google AI)
- ฐานราคา 2569: สพฐ. + สนค.สกลนคร ฝังใน prompt (~54KB)
- Excel export: ปร.4(ก) + ปร.5 + ปร.6 + Factor F ตามกรมบัญชีกลาง
- Supabase: Auth Google, RBAC admin/user, Storage bucket "drawings"

## ไฟล์สำคัญ
- `src/services/aiPrompts.ts` — AI prompt ทั้ง 4 mode + ฐานราคา + กฎวิศวกรรม (~54KB)
- `src/services/aiEngines.ts` — config 5 AI engines
- `src/services/aiAnalyze.ts` — วิเคราะห์แบบด้วย AI
- `src/services/govExcelExport.ts` — export ปร.4+5+6 (~1000 lines)
- `src/components/ai/AIPanel.tsx` — UI วิเคราะห์ AI
- `src/components/boq/BOQPanel.tsx` — UI ตาราง BOQ + export
- `src/lib/supabase.ts` — Supabase client + RLS diagnostic

## กฎ
- **ภาษาไทย** ใน UI, comments, commit messages
- **append-only** สำหรับ aiPrompts.ts — ห้ามลบข้อมูลเดิม เพิ่มต่อท้ายเท่านั้น
- ราคาอ้างอิง **สพฐ. เป็นหลัก** + สนค. เป็นข้อมูลเสริม
- Factor F ตามตาราง **สำนักงบประมาณ** (ดอกเบี้ย 6%, VAT 7%)
- ค่าแรงอ้างอิง **ว.809** กรมบัญชีกลาง
- typecheck (`tsc -b --noEmit`) + lint (`eslint . --max-warnings 0`) ต้องผ่านก่อน commit
- ใช้ `git add -A && git commit -m "..." && git push` ทุกครั้ง

## API Keys (.env.local)
```
VITE_SUPABASE_URL=https://buklxcucghgwxqpmkybt.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_OPENROUTER_API_KEY=...     # Claude + GPT-5.4 + GPT-4.1 Mini
VITE_GEMINI_API_KEY=...         # Gemini Pro + Flash
VITE_DEV_BYPASS_AUTH=true       # dev only
```

## งานที่เหลือ
1. ทดสอบ AI กับแบบจริง — ปรับ prompt ให้ accuracy ≥90%
2. เครื่องมือวัดบนแบบ — scale calibration, node-to-node snap, area measurement
3. Deploy production
