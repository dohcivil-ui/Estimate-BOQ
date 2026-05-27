-- ============================================================
-- Supabase Migration: price_catalog table
-- Source: บัญชีราคาค่าวัสดุและค่าแรงงาน สพฐ. 2569
-- ============================================================

-- 1. สร้างตาราง price_catalog
CREATE TABLE IF NOT EXISTS public.price_catalog (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code        TEXT NOT NULL,                -- CODE จาก สพฐ. เช่น A1000, B3001
  description TEXT NOT NULL,                -- รายการ
  unit        TEXT NOT NULL,                -- หน่วย: ลบ.ม., ตร.ม., ตัน, ชุด, จุด
  mat_cost    NUMERIC(12,2) DEFAULT 0,      -- ค่าวัสดุ (บาท)
  labor_cost  NUMERIC(12,2) DEFAULT 0,      -- ค่าแรง (บาท)
  category    TEXT NOT NULL,                -- หมวดหลัก: A1, B3, D1 ฯลฯ
  subcategory TEXT,                         -- หมวดย่อย
  note        TEXT,                         -- หมายเหตุ
  source      TEXT DEFAULT 'สพฐ.2569',      -- แหล่งอ้างอิง
  year        INT DEFAULT 2569,             -- ปีงบประมาณ
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index สำหรับค้นหาเร็ว
CREATE INDEX IF NOT EXISTS idx_price_catalog_code ON public.price_catalog(code);
CREATE INDEX IF NOT EXISTS idx_price_catalog_category ON public.price_catalog(category);
CREATE INDEX IF NOT EXISTS idx_price_catalog_search ON public.price_catalog 
  USING GIN (to_tsvector('simple', description));

-- 3. RLS (Row Level Security)
ALTER TABLE public.price_catalog ENABLE ROW LEVEL SECURITY;

-- ทุกคนอ่านได้ (ราคากลาง = ข้อมูลสาธารณะ)
CREATE POLICY "price_catalog_read_all" ON public.price_catalog
  FOR SELECT USING (true);

-- เฉพาะ admin แก้ไขได้
CREATE POLICY "price_catalog_admin_write" ON public.price_catalog
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- 4. ตาราง Factor F
CREATE TABLE IF NOT EXISTS public.factor_f (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cost_million    NUMERIC(10,4) NOT NULL,   -- ค่างาน (ล้านบาท)
  advance_pct     NUMERIC(5,2) DEFAULT 0,   -- เงินล่วงหน้าจ่าย %
  retention_pct   NUMERIC(5,2) DEFAULT 0,   -- เงินประกันผลงาน %
  interest_pct    NUMERIC(5,2) DEFAULT 7,   -- ดอกเบี้ยเงินกู้ %/ปี
  vat_pct         NUMERIC(5,2) DEFAULT 7,   -- VAT %
  factor_value    NUMERIC(10,4) NOT NULL,   -- ค่า Factor F
  source          TEXT DEFAULT 'สพฐ.2569',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.factor_f ENABLE ROW LEVEL SECURITY;
CREATE POLICY "factor_f_read_all" ON public.factor_f FOR SELECT USING (true);

-- 5. Function ค้นหาราคา
CREATE OR REPLACE FUNCTION search_price(search_text TEXT, cat TEXT DEFAULT NULL)
RETURNS TABLE (
  code TEXT, description TEXT, unit TEXT, 
  mat_cost NUMERIC, labor_cost NUMERIC,
  category TEXT, note TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.code, p.description, p.unit, 
         p.mat_cost, p.labor_cost, p.category, p.note
  FROM public.price_catalog p
  WHERE p.is_active = TRUE
    AND (cat IS NULL OR p.category = cat)
    AND (
      p.description ILIKE '%' || search_text || '%'
      OR p.code ILIKE '%' || search_text || '%'
    )
  ORDER BY p.category, p.code
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Function คำนวณ Factor F (interpolation)
CREATE OR REPLACE FUNCTION calc_factor_f(
  cost_value NUMERIC,
  adv_pct NUMERIC DEFAULT 0,
  ret_pct NUMERIC DEFAULT 0
) RETURNS NUMERIC AS $$
DECLARE
  lower_rec RECORD;
  upper_rec RECORD;
  result NUMERIC;
BEGIN
  -- หา row ที่ cost_million <= cost_value (ตัวต่ำ)
  SELECT * INTO lower_rec FROM public.factor_f
    WHERE cost_million <= cost_value 
      AND advance_pct = adv_pct AND retention_pct = ret_pct
    ORDER BY cost_million DESC LIMIT 1;
  
  -- หา row ที่ cost_million > cost_value (ตัวสูง)
  SELECT * INTO upper_rec FROM public.factor_f
    WHERE cost_million > cost_value 
      AND advance_pct = adv_pct AND retention_pct = ret_pct
    ORDER BY cost_million ASC LIMIT 1;
  
  -- ถ้าตรงพอดี
  IF lower_rec.cost_million = cost_value THEN
    RETURN lower_rec.factor_value;
  END IF;
  
  -- Interpolation: F = D - [(D-E) × (A-B)] / (C-B)
  IF lower_rec IS NOT NULL AND upper_rec IS NOT NULL THEN
    result := lower_rec.factor_value - (
      (lower_rec.factor_value - upper_rec.factor_value) 
      * (cost_value - lower_rec.cost_million)
      / (upper_rec.cost_million - lower_rec.cost_million)
    );
    RETURN ROUND(result, 4);
  END IF;
  
  -- Fallback
  RETURN COALESCE(lower_rec.factor_value, upper_rec.factor_value, 1.2066);
END;
$$ LANGUAGE plpgsql STABLE;
