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

## ✅ AI Accuracy — ทดสอบแล้ว (26 พ.ค. 2569)
- แบบทดสอบ: อาคารโดมอเนกประสงค์ 23 หน้า (Attach_TOR_1.pdf)
- Engine: Claude Sonnet 4.6 via OpenRouter
- Default resolution: 3000px / HD: 4000px

### ผลทดสอบ
| Mode | หน้า | Accuracy | หมายเหตุ |
|---|---|---|---|
| Structural | P17 ฐานราก | ≥93% | F1=2, F2=12 ตรง 100% |
| Structural | P7 หลังคา | ≥90% | วัสดุมุง 206 ตร.ม. + แป + truss |
| Architectural | P5 แปลนพื้น | ≥85% | 20×10, open-structure, ไม่กุผนัง |

### กฎ AI (append-only ใน aiPrompts.ts)
| กฎ | ตำแหน่ง | หน้าที่ |
|---|---|---|
| 5 | ARCHITECTURAL | ตรวจจับอาคารเปิดโล่ง |
| 6-8 | SYSTEM (ทุก mode) | มิติไม่ชัด/cross-check/resolution |
| 9 | STRUCTURAL | วัสดุมุงหลังคาใน structural |
| 10 | SYSTEM (ทุก mode) | confidence: measured/calculated/estimated |
| 11-12 | STRUCTURAL | นับฐาน/เสาจาก grid + ระบุตำแหน่ง |

## ไฟล์สำคัญ
- `src/services/aiPrompts.ts` — AI prompt 4 mode + ฐานราคา + ตารางเหล็กรูปพรรณ + กฎ accuracy 5-12 (~102KB)
- `src/services/aiEngines.ts` — config 5 AI engines (default 3000px / HD 4000px; qwen 1500/2500)
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
1. AI accuracy — เพิ่มกฎ 5-12 + HD 3000px แล้ว (dimension/นับฐาน/open-structure/วัสดุมุง แก้ได้); เหลือทดสอบแบบหลากหลายขึ้น + mode ไฟฟ้า/สุขาภิบาล
2. เครื่องมือวัดบนแบบ — scale calibration, node-to-node snap, area measurement
3. Deploy production
