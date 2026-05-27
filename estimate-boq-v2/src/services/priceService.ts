/**
 * priceService — lookup ราคาจาก Supabase table `price_catalog` + คำนวณ Factor F (rpc)
 *
 * หมายเหตุ: lib/supabase ใช้ lazy client (อาจ null ถ้ายังไม่ตั้ง env) จึงเรียก
 * requireSupabase() ในแต่ละฟังก์ชัน แทนการ import client ตรง ๆ
 */
import { requireSupabase } from '@/lib/supabase';

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
export async function searchPrice(
  query: string,
  category?: string,
): Promise<PriceItem[]> {
  const supabase = requireSupabase();
  let q = supabase
    .from('price_catalog')
    .select('code,description,unit,mat_cost,labor_cost,category,note')
    .eq('is_active', true);
  if (category) q = q.eq('category', category);
  q = q.or(`description.ilike.%${query}%,code.ilike.%${query}%`);
  const { data, error } = await q.limit(20);
  if (error) throw error;
  return data || [];
}

// ดึงราคาตาม code
export async function getPriceByCode(code: string): Promise<PriceItem | null> {
  const supabase = requireSupabase();
  const { data } = await supabase
    .from('price_catalog')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single();
  return data;
}

// คำนวณ Factor F
export async function calcFactorF(costMillionBaht: number): Promise<number> {
  const supabase = requireSupabase();
  const { data } = await supabase.rpc('calc_factor_f', {
    cost_value: costMillionBaht,
  });
  return data || 1.2066;
}
