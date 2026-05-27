-- ═══════════════════════════════════════════════════════════════════════
-- Reactive BOQ v2 — เพิ่ม page_id + discipline ให้ boq_items
-- ═══════════════════════════════════════════════════════════════════════
-- รองรับ disciplineGroups[] (แยก BOQ ตาม discipline + หน้าแบบ)
--   - NULLABLE: แถวเก่า (ก่อน v2) จะมีค่า null → ตอน load จัดเป็นกลุ่ม 'ungrouped'
--     (backfill discipline จาก category) — ไม่ crash ไม่ drop รายการเก่า
--   - page_id เป็น text (ไม่ผูก FK กับ drawing_pages) เพราะรองรับค่าพิเศษ
--     เช่น 'manual' (เพิ่มเอง), 'ungrouped' (ข้อมูลเดิม)
-- ═══════════════════════════════════════════════════════════════════════

alter table public.boq_items add column if not exists page_id    text;
alter table public.boq_items add column if not exists discipline text;

create index if not exists idx_boq_page on public.boq_items(project_id, page_id);
