# คำสั่งสำหรับ Claude Code — Knowledge Bank + Supabase Price Catalog

## งานที่ต้องทำ (เรียงลำดับ)

### Step 1: Run Supabase Migration
```powershell
cd "D:\BOQ Estimate\estimate-boq-v2"
# คัดลอกไฟล์ SQL ที่ดาวน์โหลดมาไว้ใน supabase/migrations/
# แล้ว run:
supabase db push
# หรือถ้าใช้ Dashboard: ไปที่ SQL Editor แล้ว paste ทีละไฟล์
# 1. 001_create_price_catalog.sql (สร้างตาราง)
# 2. 002_seed_price_catalog.sql (ใส่ข้อมูล 142 รายการ + Factor F 23 ช่วง)
```

### Step 2: สร้าง price lookup service
สร้างไฟล์ `src/services/priceService.ts`:
```typescript
import { supabase } from '../lib/supabase';

export interface PriceItem {
  code: string;
  description: string;
  unit: string;
  mat_cost: number;
  labor_cost: number;
  category: string;
  note: string | null;
}

// ค้นหาราคาจาก Supabase
export async function searchPrice(query: string, category?: string): Promise<PriceItem[]> {
  let q = supabase.from('price_catalog').select('code,description,unit,mat_cost,labor_cost,category,note')
    .eq('is_active', true);
  
  if (category) q = q.eq('category', category);
  q = q.or(`description.ilike.%${query}%,code.ilike.%${query}%`);
  
  const { data, error } = await q.limit(20);
  if (error) throw error;
  return data || [];
}

// ดึงราคาตาม code ตรงๆ
export async function getPriceByCode(code: string): Promise<PriceItem | null> {
  const { data } = await supabase.from('price_catalog')
    .select('*').eq('code', code).eq('is_active', true).single();
  return data;
}

// คำนวณ Factor F
export async function calcFactorF(costMillionBaht: number): Promise<number> {
  const { data } = await supabase.rpc('calc_factor_f', { 
    cost_value: costMillionBaht 
  });
  return data || 1.2066;
}

// ดึงราคาตามหมวด (สำหรับแสดง dropdown)
export async function getPricesByCategory(cat: string): Promise<PriceItem[]> {
  const { data } = await supabase.from('price_catalog')
    .select('code,description,unit,mat_cost,labor_cost,category,note')
    .eq('category', cat).eq('is_active', true)
    .order('code');
  return data || [];
}
```

### Step 3: อัปเดต AI prompt ให้ใช้ knowledge bank
ในไฟล์ `src/services/aiPrompts.ts` เพิ่มข้อความจากไฟล์ `ai_knowledge_bank_estimation.md`
ฉีดเข้า system prompt:
- สูตรคำนวณปริมาณงาน (ขุดดิน, คอนกรีต, เหล็ก, ไม้แบบ)
- กฎลดไม้แบบ (80/70/60/50%)
- เผื่อเศษเหล็ก (5-15% ตามขนาด)
- ลวดผูกเหล็ก 30 กก./ตัน
- ค่าแรงคอนกรีต (ติดดิน 327, ชั้นเดียว 419, หลายชั้น 512)

### Step 4: ต่อ price lookup เข้า BOQ flow
เมื่อ AI วิเคราะห์แบบเสร็จ ก่อน accept:
1. AI ส่ง items กลับมา (description + quantity)
2. แอป lookup ราคาจาก price_catalog ตาม description
3. ถ้าเจอ → ใส่ mat_cost + labor_cost อัตโนมัติ
4. ถ้าไม่เจอ → ใช้ราคาที่ AI ประมาณ (fallback)

## ไฟล์ที่ต้องแก้
1. `src/services/priceService.ts` — ใหม่
2. `src/services/aiPrompts.ts` — เพิ่ม knowledge bank
3. `src/components/ai/AIPanel.tsx` — ต่อ lookup ตอน accept
4. `supabase/migrations/` — 2 ไฟล์ SQL

## ทดสอบ
1. เปิด Supabase Dashboard → Table Editor → ดูตาราง price_catalog มี 142 rows
2. ลอง SQL: `SELECT * FROM search_price('คอนกรีต', 'A4')`
3. ลอง Factor F: `SELECT calc_factor_f(17.286)` → ควรได้ ~1.2560
4. กดปุ่ม 🤖 วิเคราะห์ → ค่าแรงโครงสร้างต้องไม่ = 0 อีกต่อไป
