# 🎯 Cursor Prompt — เพิ่มฟีเจอร์ AI อ่านหลายหน้า + แชทสั่งงาน

> คัดลอกทั้งหมดนี้วางใน Cursor (ต่อจาก prompt 4 disciplines ที่ทำไปแล้ว)

---

## ปัญหาที่ต้องแก้

AI วิเคราะห์แบบทีละหน้าเดียว → ไม่รู้ความหมายของสัญลักษณ์ (F1, F2, C1, C2...)
เพราะสัญลักษณ์เหล่านี้อยู่ในหน้า "รายการประกอบแบบ" หรือ "รายการวัสดุ" (ปกติหน้า 1-2)
แต่ AI ไปวิเคราะห์แค่หน้าผังพื้น (หน้า 5+) จึงเดาวัสดุผิด

## ฟีเจอร์ที่ 1: อ่านหน้าอ้างอิงก่อนวิเคราะห์ (Reference Pages)

### UI เพิ่มเติมใน AI Panel:

ก่อนปุ่ม "🤖 วิเคราะห์หน้านี้ด้วย AI" ให้เพิ่ม section:

```
📋 หน้าอ้างอิง (Reference Pages)
┌─────────────────────────────────────────┐
│ ☑ หน้า 1 — รายการวัสดุ/สัญลักษณ์       │
│ ☐ หน้า 2 — รายการวัสดุ (ต่อ)           │
│ ☐ หน้า 3 — รายละเอียดทั่วไป            │
│                                         │
│ [+ เพิ่มหน้าอ้างอิง ▼]                  │
└─────────────────────────────────────────┘
```

### หลักการทำงาน:

1. ผู้ใช้เปิด PDF → thumbnail ซ้ายแสดงทุกหน้า
2. ก่อนกด AI วิเคราะห์ ผู้ใช้เลือก "หน้าอ้างอิง" (checkbox)
3. ตอนกด วิเคราะห์ → ระบบส่งภาพ **หลายหน้า** ไป Qwen:
   - หน้าอ้างอิง (render เป็น image ก่อน) → เป็น context
   - หน้าที่จะวิเคราะห์ → เป็น target
4. AI ได้เห็นทั้งรายการวัสดุ + ผังพื้น → ถอดปริมาณถูกต้อง

### แก้ไข `src/services/aiAnalyze.ts`:

```typescript
export async function analyzeDrawing(
  targetImageDataUrl: string,
  mode: DisciplineMode | 'auto',
  referenceImages?: { pageNum: number; dataUrl: string; label: string }[]
): Promise<AnalysisResult> {
  
  const systemPrompt = getPromptForMode(mode as DisciplineMode);
  
  // สร้าง messages content array
  const contentParts: any[] = [];
  
  // 1. ส่งหน้าอ้างอิงก่อน (ถ้ามี)
  if (referenceImages && referenceImages.length > 0) {
    contentParts.push({
      type: "text",
      text: `📋 หน้าอ้างอิง ${referenceImages.length} หน้า — อ่านสัญลักษณ์วัสดุและรายการประกอบแบบจากหน้าเหล่านี้ก่อน:`
    });
    
    for (const ref of referenceImages) {
      contentParts.push({
        type: "text",
        text: `--- หน้า ${ref.pageNum}: ${ref.label} ---`
      });
      contentParts.push({
        type: "image_url",
        image_url: { url: ref.dataUrl }
      });
    }
    
    contentParts.push({
      type: "text",
      text: `\n📐 หน้าที่ต้องวิเคราะห์ (ใช้ข้อมูลจากหน้าอ้างอิงด้านบนประกอบ):`
    });
  }
  
  // 2. ส่งหน้าเป้าหมาย
  contentParts.push({
    type: "image_url",
    image_url: { url: targetImageDataUrl }
  });
  
  // 3. คำสั่งวิเคราะห์
  contentParts.push({
    type: "text",
    text: getUserPromptForMode(mode as DisciplineMode)
      + (referenceImages?.length 
         ? '\n\n⚠️ สำคัญ: ใช้ข้อมูลจากหน้าอ้างอิง (รายการวัสดุ/สัญลักษณ์) ที่ส่งมาด้านบน อย่าเดาชนิดวัสดุเอง — ถ้าสัญลักษณ์ไหนไม่มีในรายการอ้างอิง ให้ระบุว่า "ไม่พบในรายการอ้างอิง — ต้องยืนยัน"' 
         : '')
  });
  
  // 4. เรียก Qwen API
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: contentParts }
  ];
  
  // ... เรียก API เหมือนเดิม แต่ใช้ messages นี้
}
```

### การ render หน้าอ้างอิงเป็นภาพ:

ใช้ PDF.js render หน้าที่เลือกเป็น canvas → toDataURL():
```typescript
async function renderPageToImage(pdfDoc: PDFDocumentProxy, pageNum: number, maxWidth: number = 1500): Promise<string> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(maxWidth / viewport.width, 2);
  const scaledViewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;
  const ctx = canvas.getContext('2d')!;
  
  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.85);
}
```

### ข้อจำกัด:
- จำกัดหน้าอ้างอิงสูงสุด 3 หน้า (token limit)
- resize ภาพอ้างอิงเล็กลง 1000px max (ประหยัด token)
- ภาพเป้าหมาย 1500px (หรือ HD ถ้าเปิด toggle)

---

## ฟีเจอร์ที่ 2: แชทสั่งงาน AI (AI Chat)

### UI เพิ่มเติม:

ที่ด้านล่างของ AI Panel เพิ่ม chat input:

```
┌─────────────────────────────────────────┐
│ 💬 สั่งงาน AI เพิ่มเติม                 │
│                                         │
│ ┌─────────────────────────────────┐ 📤  │
│ │ พิมพ์คำสั่ง เช่น "ดูหน้า 1      │     │
│ │ ก่อนแล้ววิเคราะห์ใหม่"          │     │
│ └─────────────────────────────────┘     │
│                                         │
│ 💡 ตัวอย่างคำสั่ง:                       │
│ • "ดูรายการวัสดุหน้า 1 ก่อน"            │
│ • "F2 คือกระเบื้องกันลื่น ไม่ใช่ขัดมัน"  │
│ • "วิเคราะห์ใหม่ เน้นนับประตู-หน้าต่าง"  │
│ • "เพิ่มเสาเอ็นรอบช่องเปิดทุกช่อง"      │
│ • "ผนังนอกใช้อิฐมอญ ไม่ใช่มวลเบา"      │
└─────────────────────────────────────────┘
```

### หลักการทำงาน:

1. **Chat = ส่ง follow-up message ไป Qwen** พร้อม context เดิม
2. เก็บ conversation history ต่อ page:
   ```typescript
   interface AiConversation {
     pageId: string;
     messages: { role: 'user' | 'assistant'; content: string }[];
     currentResult: AnalysisResult | null;
   }
   ```
3. เมื่อ user พิมพ์ข้อความ → ส่งไปพร้อม:
   - system prompt เดิม
   - ภาพหน้าอ้างอิง (ถ้ามี)
   - ภาพหน้าเป้าหมาย
   - ผลวิเคราะห์ก่อนหน้า (เป็น JSON)
   - คำสั่งใหม่จาก user
4. AI ตอบกลับ → อัปเดตผลวิเคราะห์ หรือตอบคำถาม

### ตัวอย่าง Flow:

```
[ผู้ใช้] กดวิเคราะห์หน้า 5 (mode สถาปัตย์)
[AI] → ผล: F1 = กระเบื้อง 380 ตร.ม., F2 = คอนกรีตขัดมัน 60 ตร.ม. ...
[ผู้ใช้] พิมพ์: "F2 ไม่ใช่คอนกรีตขัดมัน ดูหน้า 1 — F2 คือกระเบื้องเคลือบ 24×24 กันลื่น"
[AI] → อัปเดต: F2 = กระเบื้องเคลือบ 24"×24" กันลื่น 60 ตร.ม. 
       + วัสดุ: กระเบื้อง 66 ตร.ม.(เผื่อ10%), ปูนกาว 7.5 ถุง ...
[ผู้ใช้] พิมพ์: "เพิ่มงานยาแนวกระเบื้อง F2 ด้วย"
[AI] → เพิ่ม: ยาแนวกระเบื้อง 18 กก. (0.3 กก./ตร.ม. × 60 ตร.ม.)
```

### แก้ไข messages ที่ส่ง API (follow-up):

```typescript
async function chatWithAI(
  userMessage: string,
  conversation: AiConversation,
  targetImage: string,
  referenceImages?: { pageNum: number; dataUrl: string }[],
  mode: DisciplineMode
): Promise<string> {
  
  const messages: any[] = [
    { role: "system", content: getPromptForMode(mode) },
  ];
  
  // ส่งรูปเป็น context ครั้งแรก (ไม่ต้องส่งซ้ำทุกรอบ — ประหยัด token)
  if (conversation.messages.length === 0) {
    // ส่งรูปครั้งแรก
    const content: any[] = [];
    if (referenceImages) {
      for (const ref of referenceImages) {
        content.push({ type: "image_url", image_url: { url: ref.dataUrl } });
      }
    }
    content.push({ type: "image_url", image_url: { url: targetImage } });
    content.push({ type: "text", text: "นี่คือแบบที่กำลังวิเคราะห์" });
    messages.push({ role: "user", content });
    messages.push({ role: "assistant", content: JSON.stringify(conversation.currentResult) });
  }
  
  // ส่ง conversation history
  for (const msg of conversation.messages) {
    messages.push(msg);
  }
  
  // ส่งข้อความใหม่
  messages.push({
    role: "user",
    content: userMessage + '\n\nตอบเป็น JSON format เดิม ถ้าเป็นการแก้ไข ส่ง items ที่แก้ไขแล้วกลับมา ถ้าเป็นคำถาม ตอบใน notes'
  });
  
  // เรียก API
  const result = await callQwenAPI(messages);
  return result;
}
```

### UI ของ chat messages:

```
┌─────────────────────────────────────┐
│ 🧑 F2 ไม่ใช่คอนกรีตขัดมัน ดูหน้า 1│
│    F2 = กระเบื้องเคลือบ 24×24 กันลื่น │
│                              21:42 │
├─────────────────────────────────────┤
│ 🤖 อัปเดตแล้ว:                      │
│    F2 → กระเบื้องเคลือบ 24"×24"    │
│    กันลื่น 60 ตร.ม.                │
│    + วัสดุ 4 รายการ                │
│    [✅ ใช้ผลนี้]  [🔄 วิเคราะห์ใหม่] │
│                              21:43 │
└─────────────────────────────────────┘
```

- แสดง chat bubbles สลับ user/AI
- ถ้า AI ส่ง JSON กลับมา → แสดงเป็นตารางเหมือนผลวิเคราะห์ปกติ
- ปุ่ม "✅ ใช้ผลนี้" → อัปเดตผลวิเคราะห์หลัก
- ปุ่ม "🔄 วิเคราะห์ใหม่" → ส่งรูปใหม่พร้อม context ทั้งหมด

---

## ฟีเจอร์ที่ 3: ปุ่มลัด "📋 ดูรายการวัสดุก่อน"

เพิ่มปุ่มลัดใน AI Panel:

```
[📋 ดูรายการวัสดุก่อน]
```

เมื่อกด → เปิด modal ให้เลือกหน้ารายการวัสดุ:
1. แสดง thumbnail ทุกหน้า
2. ผู้ใช้คลิกเลือกหน้า (เลือกได้หลายหน้า)
3. กด "ตั้งเป็นหน้าอ้างอิง"
4. หน้าที่เลือกจะถูก set เป็น reference pages อัตโนมัติ
5. ครั้งต่อไปกด AI วิเคราะห์ จะส่งหน้าอ้างอิงไปด้วยเสมอ

### เก็บ reference pages ใน state:

```typescript
// ใน Zustand store
interface DrawingState {
  referencePages: number[];  // เก็บหมายเลขหน้าที่เป็น reference
  setReferencePages: (pages: number[]) => void;
  // ... state อื่นๆ
}
```

- เก็บใน localStorage ด้วย → ครั้งหน้าเปิดไฟล์เดิมไม่ต้องเลือกใหม่
- แสดง badge จำนวนหน้าอ้างอิงบนปุ่ม: `📋 อ้างอิง (2)`

---

## สรุปไฟล์ที่ต้องแก้/สร้าง

| ไฟล์ | งาน |
|------|-----|
| `src/services/aiAnalyze.ts` | แก้ — รับ referenceImages + chat follow-up |
| AI Panel component | แก้ — เพิ่ม reference page checkboxes + chat input |
| `src/components/AiChat.tsx` | สร้างใหม่ — chat bubbles UI |
| `src/components/RefPageSelector.tsx` | สร้างใหม่ — modal เลือกหน้าอ้างอิง |
| Zustand store | แก้ — เพิ่ม referencePages + conversation state |

## ลำดับความสำคัญ

1. **ทำก่อน**: Reference Pages (ส่งหลายหน้า) — แก้ปัญหาหลัก AI เดาวัสดุผิด
2. **ทำต่อ**: Chat สั่งงาน — ให้แก้ไขผลวิเคราะห์ได้ไม่ต้องวิเคราะห์ใหม่
3. **ทำสุดท้าย**: ปุ่มลัด + modal เลือกหน้าอ้างอิง

## ฟีเจอร์ที่ 4: แก้ Timeout HD (สำคัญ — bug ปัจจุบัน)

ปัญหา: เปิด HD → ภาพใหญ่ + prompt ยาว → Qwen ใช้เวลาเกิน 60s → error

### แก้ไขใน `src/services/aiAnalyze.ts`:

1. **เพิ่ม timeout เป็น 120 วินาที** (จากเดิม 60s):
```typescript
const TIMEOUT_MS = 120_000; // 120s สำหรับ HD + multi-page
```

2. **แสดง progress ระหว่างรอ**:
   - 0-10s: "🤖 กำลังส่งภาพไป AI..."
   - 10-30s: "⏳ AI กำลังอ่านแบบ..."
   - 30-60s: "⏳ AI กำลังถอดปริมาณ... (ใจเย็นๆ)"
   - 60-90s: "⏳ ภาพ HD ใช้เวลานานกว่าปกติ..."
   - 90-120s: "⚠️ เกือบ timeout — อาจต้องลอง HD off"

3. **resize ภาพอ้างอิง เล็กกว่าภาพเป้าหมาย** (ประหยัด token):
   - ภาพอ้างอิง (reference): max 1000px
   - ภาพเป้าหมาย (target): max 1500px (ปกติ) / 2500px (HD)
   - ภาพอ้างอิงใช้ JPEG quality 0.70 (ต่ำกว่าเป้าหมายที่ 0.85)

4. **ถ้า timeout ให้แนะนำ**:
```
"⏱️ AI ใช้เวลาเกิน 2 นาที — ลอง:
 • ปิด HD
 • ลดจำนวนหน้าอ้างอิง
 • เลือก mode เฉพาะแทน อัตโนมัติ"
```

---

## Style:
- Dark theme เดิม, ฟอนต์ Sarabun
- Chat bubbles: user = ขอบสีฟ้าอ่อน, AI = ขอบสีเขียวอ่อน
- Reference page checkboxes: สี subtle ไม่บังผลวิเคราะห์
- Progress messages: สีเหลืองอำพัน กระพริบเบาๆ
