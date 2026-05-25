# Estimate-BOQ v2 — AI-first

โปรแกรมประมาณราคาก่อสร้าง AI-first สำหรับวิศวกรโยธาไทย
อ้างอิงค่าแรง **ว.809 (14 พ.ย. 2568) กรมบัญชีกลาง**

> นี่คือ **Track B / Phase 2** ตาม `../HANDOFF-v2.md`
> Track A (Drawing Measurement Engine v1) อยู่ที่ root ของ repo (`../src/`) ใช้คนละกฎ

## Stack

| Layer | เทคโนโลยี |
|-------|----------|
| Build/UI | Vite + React 18 + TypeScript (strict) |
| Styling | Tailwind CSS 3 (dark mode, Sarabun) |
| Canvas | react-konva |
| State | Zustand |
| PDF | pdfjs-dist |
| AI | Claude Sonnet (ผ่าน Supabase Edge Function) |
| Backend | Supabase (Auth + Postgres + Edge Functions + Storage) |
| Export | xlsx-js-style, print PDF |

## เริ่มต้น

```bash
cd estimate-boq-v2
npm install
cp .env.example .env.local   # แล้วเติมค่าจริงจาก Supabase
npm run dev
```

เปิด http://localhost:5173

## คำสั่ง

```bash
npm run dev          # vite dev server
npm run build        # tsc + vite build
npm run typecheck    # tsc -b --noEmit
npm run lint         # eslint
npm run format       # prettier
```

## โครงสร้าง

```
estimate-boq-v2/
├─ src/
│  ├─ components/      ← UI ทุก panel
│  │  ├─ TopBar.tsx
│  │  ├─ ThumbnailPanel.tsx
│  │  ├─ CanvasArea.tsx
│  │  ├─ SidePanel.tsx    (AI / BOQ / Tools tabs)
│  │  └─ StatusBar.tsx
│  ├─ lib/
│  │  └─ supabase.ts      ← Supabase client + env guard
│  ├─ stores/             ← Zustand stores (เพิ่มใน Step ถัดไป)
│  ├─ services/           ← AI/Excel/persistence (เพิ่มใน Step ถัดไป)
│  ├─ types/              ← shared types
│  ├─ App.tsx             ← 3-panel layout shell
│  ├─ main.tsx
│  └─ index.css           ← Tailwind base + Sarabun + scrollbar
├─ index.html
├─ tailwind.config.js
├─ tsconfig.json
├─ vite.config.ts
└─ .env.example
```

## Roadmap

ตาม `../HANDOFF-v2.md` ส่วน 5:

- [x] **2.0** Scaffold + layout 3 panel + Supabase client
- [ ] 2.1 Auth (Google/Facebook OAuth) + RBAC
- [ ] 2.2 Drawing Viewer — PDF/JPG + zoom/pan/thumbnail
- [ ] 2.3 Measurement Tools — scale/length/area/count + snap + ortho + rotate
- [ ] 2.4 BOQ Engine — port ค่าแรง ว.809 + ราคาวัสดุ + Factor F + Excel/PDF export
- [ ] 2.5 **AI Analysis** — Edge Function → Claude Sonnet → review panel
- [ ] 2.6 Cloud Storage — projects/shapes/boq บน Supabase
- [ ] 2.7 Custom GPT Actions
- [ ] 2.8 Admin Panel + delete requests
- [ ] 2.9 ราคา สนค. รายจังหวัด (scheduled scraper)

## หลักการ

- **AI-first แต่ Human-in-the-loop**: AI วิเคราะห์ → ผู้ใช้ตรวจ/แก้ → ยืนยัน → Export
- **ภาษาไทยทุกที่** — UI/error/log
- **ไม่หลุดความลับ** — `ANTHROPIC_API_KEY` อยู่ Supabase secret เท่านั้น frontend ไม่เห็น
- **ค่าแรง ว.809** เป็นฐาน ปรับได้
- **ราคาวัสดุ** = ไกด์รายจังหวัดจาก สนค. — เปิดให้แก้
