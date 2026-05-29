# แผนงาน Option 2+3 — AI Chat Panel (PDF-direct + Multi-turn + Import to BOQ)

## เป้าหมาย
เปลี่ยน AI Panel จาก one-shot (ส่งภาพบีบ) → chat แบบ multi-turn (ส่ง PDF ตรง) ที่:
- ส่ง PDF page ตรงให้ API (accuracy เท่าแชท)
- คุยต่อแก้ไขได้ (เก็บทั้ง conversation)
- prompt แก้ได้ + preset
- Import เข้า BOQ แบบ preview + accept ทีละ item
- default = Opus 4.6

---

## การตัดสินใจ (locked)
1. **Chat history:** เก็บทั้ง conversation (เน้นแม่น)
2. **Import to BOQ:** Preview + accept ทีละ item
3. **Default engine:** Opus 4.6

---

## Phase A — Backend: PDF-direct + Multi-turn

### A1. ส่ง PDF page ตรง (แทน image)
```
ไฟล์: src/services/aiAnalyze.ts

เดิม: render PDF page → canvas → JPEG → resize → base64 image
ใหม่: extract เฉพาะหน้าที่เลือก เป็น PDF ย่อย → ส่ง document type

ใช้ pdf-lib:
import { PDFDocument } from 'pdf-lib';

async function extractPages(sourcePdf: ArrayBuffer, pageIndices: number[]): Promise<string> {
  const src = await PDFDocument.load(sourcePdf);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, pageIndices); // 0-indexed
  copied.forEach(p => out.addPage(p));
  const bytes = await out.save();
  return base64Encode(bytes);
}

ส่งเข้า API:
content: [
  {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
    cache_control: { type: "ephemeral" }   // cache PDF ไว้ใช้ซ้ำใน turn ถัดไป
  },
  { type: "text", text: userPrompt }
]
```

### A2. Multi-turn conversation
```
ไฟล์: src/stores/aiChatStore.ts (สร้างใหม่ หรือเพิ่มใน store เดิม)

state:
  messages: Array<{ role: 'user'|'assistant', content: string }>
  pdfBase64: string | null      // เก็บ PDF ที่ extract แล้ว (ใช้ซ้ำทุก turn)
  pageSelection: { main: number, refs: number[] }

ทุกครั้งที่ user ส่งข้อความ:
  1. append { role:'user', content: prompt } เข้า messages
  2. ส่ง API:
     messages: [
       // turn แรก: แนบ PDF document + prompt
       // turn ถัดไป: แค่ text (PDF อยู่ใน cache แล้ว — อ้างอิงผ่าน history)
       ...messages
     ]
  3. append response เข้า messages
  4. ถ้า PDF ใหญ่ > 20MB → ใช้ Files API (upload ครั้งเดียว → file_id)

หมายเหตุ: turn แรกแนบ document, turn ถัดไปส่ง history (document อยู่ใน message แรกแล้ว)
```

### A3. Fallback
```
ถ้า PDF ส่งไม่ได้ (เกิน limit / error) → fallback กลับไปใช้ image แบบเดิม
เก็บ logic image ไว้ ไม่ลบ
```

---

## Phase B — Frontend: Chat UI + Editable Prompt

### B1. เปลี่ยน AnalyzePanel เป็น chat
```
ไฟล์: src/components/ai/AnalyzePanel.tsx (หรือ AnalyzeButton.tsx)

UI:
┌─────────────────────────────────┐
│ Engine: [🟣 Opus 4.6 ▼]         │
│ Preset: [โครงสร้าง ▼]            │
│ หน้าหลัก: [17] อ้างอิง: [15,16,18,19]│
│ ┌─────────────────────────────┐ │
│ │ 📝 prompt (แก้ได้)           │ │  ← textarea
│ └─────────────────────────────┘ │
│ [▶ วิเคราะห์]                   │
│ ─────────────────────────────── │
│ 💬 message bubbles (scroll)     │
│ ┌─────────────────────────────┐ │
│ │ พิมพ์เพื่อคุยต่อ...      [ส่ง]│ │
│ └─────────────────────────────┘ │
│ [📥 Import to BOQ]              │
└─────────────────────────────────┘
```

### B2. Preset prompts (ดึงจากกฎ 15 ข้อ)
```
ไฟล์: src/services/aiPresets.ts (สร้างใหม่)

export const PRESETS = {
  structural: { label: 'โครงสร้าง', prompt: STRUCTURAL_PROMPT, defaultEngine: 'anthropic-opus' },
  architectural: { label: 'สถาปัตยกรรม', prompt: ARCH_PROMPT, defaultEngine: 'anthropic-opus' },
  electrical: { label: 'ไฟฟ้า', prompt: ELEC_PROMPT, defaultEngine: 'anthropic-opus' },
  sanitary: { label: 'สุขาภิบาล', prompt: SAN_PROMPT, defaultEngine: 'anthropic-opus' },
  custom: { label: 'Custom', prompt: '', defaultEngine: 'anthropic-opus' },
};

เลือก preset → เติม prompt ลง textarea (user แก้ต่อได้)
```

### B3. Default engine = Opus
```
ใน aiChatStore: defaultEngine = 'anthropic-opus'
timeout = 300_000 (5 นาที — Opus ช้า)
```

---

## Phase C — Import to BOQ (Preview + Accept ทีละ item)

### C1. Parse JSON จาก response
```
ไฟล์: src/services/boqImporter.ts (สร้างใหม่)

function parseAIResponse(text: string): BOQItem[] {
  // หา JSON block ใน response (```json ... ```)
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return [];
  const parsed = JSON.parse(match[1]);
  return parsed.items.map(mapToBOQItem);
}
```

### C2. Preview modal + accept ทีละ item
```
ไฟล์: src/components/ai/ImportPreview.tsx (สร้างใหม่)

แสดง items ทั้งหมดเป็น list พร้อม checkbox:
☑ F2 ฐานราก 1.50×1.50×0.30 × 12 ฐาน  [✓ accept] [✕ skip]
☑ F1 ฐานราก 1.00×1.00×0.20 × 2 ฐาน   [✓ accept] [✕ skip]
☐ GS พื้น 200 ตร.ม. (confidence: medium ⚠️)  [✓] [✕]
...
[Import ที่เลือก (8)]  [ยกเลิก]

→ items ที่ accept เข้า BOQ store
→ items confidence ต่ำ ให้ highlight สีเหลือง
```

---

## JSON Schema (มาตรฐาน — AI ต้อง output ตามนี้)

```json
{
  "project": "string",
  "analyzed_pages": [17],
  "ref_pages": [15, 16, 18, 19],
  "building": {
    "name": "string",
    "dimension": "20.00×10.00",
    "area_sqm": 200,
    "floors": 1,
    "structure_type": "string"
  },
  "items": [
    {
      "id": 1,
      "category": "ฐานราก",
      "name": "F2,C2 ฐานรากเดี่ยว",
      "size": "1.50×1.50×0.30",
      "qty": 12,
      "unit": "ฐาน",
      "rebar": "DB12@0.09 ทั้ง 2 ทาง",
      "grid_positions": ["1A","2A","..."],
      "source": "วัดจากแบบ",
      "confidence": "high",
      "ref_sheet": "S2-02",
      "calc": "สูตรคำนวณ (ถ้ามี)",
      "note": "หมายเหตุ (ถ้ามี)"
    }
  ],
  "notes": ["string"],
  "warnings": ["❓ string"]
}
```

**กฎ JSON:**
- `confidence`: "high" | "medium" | "low"
- `source`: "วัดจากแบบ" | "คำนวณ" | "ประมาณ"
- `unit`: ฐาน | ต้น | ตัว | ตร.ม. | ลบ.ม. | เมตร | ชุด
- ทุก item ต้องมี id, category, name, qty, unit, source, confidence
- items ที่ confidence=low หรือมี note → highlight ใน preview

---

## ลำดับการสั่ง CC

```
Phase A (backend) → ทดสอบส่ง PDF ได้ก่อน
Phase B (chat UI) → ทดสอบคุยต่อได้
Phase C (import) → ทดสอบ accept เข้า BOQ

แต่ละ phase: typecheck + lint + commit + push ก่อนไป phase ถัดไป
ทดสอบ P17 หลัง Phase A เทียบกับผลแชท (ควรได้ F2=12, dim 20×10)
```
