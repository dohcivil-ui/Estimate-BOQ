-- ═══════════════════════════════════════════════════════════════════════
-- drawing_pages: rescope unique (project_id, page_index) → (file_id, page_index)
-- ═══════════════════════════════════════════════════════════════════════
-- เหตุผล: page_index นับ "ต่อไฟล์" (1..N ของแต่ละไฟล์) แต่ unique เดิมผูก
--   (project_id, page_index) ทั้งโปรเจกต์ → โปรเจกต์ ≥2 ไฟล์ page_index ชน
--   ข้ามไฟล์ → INSERT ชน drawing_pages_project_id_page_index_key (23505)
-- แก้: unique ตามความจริง = หน้าเป็น unique "ต่อไฟล์"
-- ไม่แตะโค้ด app (save ส่ง file_id อยู่แล้ว · onConflict:'id' ใช้ id ไม่ใช่ unique นี้)
-- หมายเหตุ: apply เข้า prod ผ่าน SQL editor แล้ว (7 มิ.ย. 2569) — ไฟล์นี้เป็น record (idempotent)
-- ═══════════════════════════════════════════════════════════════════════

-- 1) drop unique เดิม (idempotent)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'drawing_pages_project_id_page_index_key'
      and conrelid = 'public.drawing_pages'::regclass
  ) then
    alter table public.drawing_pages
      drop constraint drawing_pages_project_id_page_index_key;
  end if;
end$$;

-- 2) add unique ใหม่ (file_id, page_index) (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'drawing_pages_file_id_page_index_key'
      and conrelid = 'public.drawing_pages'::regclass
  ) then
    alter table public.drawing_pages
      add constraint drawing_pages_file_id_page_index_key
      unique (file_id, page_index);
  end if;
end$$;
