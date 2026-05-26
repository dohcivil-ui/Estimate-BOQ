-- ═══════════════════════════════════════════════════════════════════════
-- Estimate-BOQ v2 — Fix RLS Policies (idempotent, ปลอดภัยรันซ้ำได้)
-- ═══════════════════════════════════════════════════════════════════════
-- รันใน Supabase SQL Editor:
--   https://supabase.com/dashboard/project/<your-project>/sql
--
-- ใช้เมื่อพบ error: "new row violates row-level security policy"
-- ตอนกดบันทึกโปรเจกต์ / upload PDF
--
-- ครอบคลุม:
--   1. ตรวจ RLS status ของทุก table (diagnostic)
--   2. ตรวจว่า trigger on_auth_user_created + handle_new_user มีอยู่จริง
--   3. Re-create RLS policies ทุก table (DROP + CREATE)
--   4. Re-create Storage bucket + policies (drawings)
--   5. ensure_profile() helper สำหรับ recover profile ที่ trigger พลาด
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 0. Diagnostic (uncomment เพื่อดูสถานะ) ─────────────────────────────
-- select schemaname, tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
-- order by tablename;
--
-- select tablename, policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, cmd;
--
-- select * from storage.buckets where id = 'drawings';
-- select policyname, cmd from pg_policies where schemaname='storage' and tablename='objects';

-- ─── 1. ตรวจ helper function is_admin() ─────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ─── 2. Trigger handle_new_user (recreate ปลอดภัย) ──────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── 3. ensure_profile() — frontend เรียกก่อน save ถ้าสงสัยว่า profile ขาด
create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_email text;
  v_name text;
  v_avatar text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'No auth.uid() — must be logged in';
  end if;

  -- ดึงข้อมูลจาก auth.users (security definer ให้สิทธิ์อ่าน)
  select email,
         coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
         raw_user_meta_data ->> 'avatar_url'
    into v_email, v_name, v_avatar
  from auth.users where id = v_uid;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (v_uid, v_email, v_name, v_avatar, 'user')
  on conflict (id) do nothing;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;

-- ─── 4. RLS — เปิดทุก table (กัน accidental disable) ────────────────────
alter table public.profiles         enable row level security;
alter table public.projects         enable row level security;
alter table public.drawing_pages    enable row level security;
alter table public.drawing_files    enable row level security;
alter table public.shapes           enable row level security;
alter table public.boq_items        enable row level security;
alter table public.ai_analyses      enable row level security;
alter table public.material_prices  enable row level security;
alter table public.delete_requests  enable row level security;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. profiles policies
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_insert_self"          on public.profiles;
drop policy if exists "profiles_update_self"          on public.profiles;
drop policy if exists "profiles_admin_all"            on public.profiles;

create policy "profiles_select_self_or_admin" on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.is_admin());

-- อนุญาตให้ user insert profile ของตัวเอง (เผื่อ trigger ไม่ทำงาน)
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
  );

create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- 6. projects policies
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "projects_owner_or_admin_select" on public.projects;
drop policy if exists "projects_owner_insert"           on public.projects;
drop policy if exists "projects_owner_or_admin_update"  on public.projects;
drop policy if exists "projects_admin_delete"           on public.projects;

create policy "projects_owner_or_admin_select" on public.projects
  for select to authenticated
  using (auth.uid() = owner_id or public.is_admin());

create policy "projects_owner_insert" on public.projects
  for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "projects_owner_or_admin_update" on public.projects
  for update to authenticated
  using (auth.uid() = owner_id or public.is_admin())
  with check (auth.uid() = owner_id or public.is_admin());

create policy "projects_admin_delete" on public.projects
  for delete to authenticated
  using (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- 7. drawing_files policies (FOR ALL — ครอบคลุม INSERT/UPDATE/DELETE)
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "drawing_files_via_project"        on public.drawing_files;
drop policy if exists "drawing_files_select_via_project" on public.drawing_files;
drop policy if exists "drawing_files_insert_via_project" on public.drawing_files;
drop policy if exists "drawing_files_update_via_project" on public.drawing_files;
drop policy if exists "drawing_files_delete_via_project" on public.drawing_files;

create policy "drawing_files_select_via_project" on public.drawing_files
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = drawing_files.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "drawing_files_insert_via_project" on public.drawing_files
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = drawing_files.project_id
        and p.owner_id = auth.uid()
    ) or public.is_admin()
  );

create policy "drawing_files_update_via_project" on public.drawing_files
  for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = drawing_files.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = drawing_files.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "drawing_files_delete_via_project" on public.drawing_files
  for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = drawing_files.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 8. drawing_pages policies
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "drawing_pages_via_project"        on public.drawing_pages;
drop policy if exists "drawing_pages_select_via_project" on public.drawing_pages;
drop policy if exists "drawing_pages_insert_via_project" on public.drawing_pages;
drop policy if exists "drawing_pages_update_via_project" on public.drawing_pages;
drop policy if exists "drawing_pages_delete_via_project" on public.drawing_pages;

create policy "drawing_pages_select_via_project" on public.drawing_pages
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = drawing_pages.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "drawing_pages_insert_via_project" on public.drawing_pages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = drawing_pages.project_id
        and p.owner_id = auth.uid()
    ) or public.is_admin()
  );

create policy "drawing_pages_update_via_project" on public.drawing_pages
  for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = drawing_pages.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = drawing_pages.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "drawing_pages_delete_via_project" on public.drawing_pages
  for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = drawing_pages.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 9. shapes policies
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "shapes_via_project_rw"       on public.shapes;
drop policy if exists "shapes_via_project_insert"   on public.shapes;
drop policy if exists "shapes_via_project_update"   on public.shapes;
drop policy if exists "shapes_via_project_select"   on public.shapes;
drop policy if exists "shapes_via_project_delete"   on public.shapes;
drop policy if exists "shapes_admin_delete"         on public.shapes;

create policy "shapes_via_project_select" on public.shapes
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = shapes.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "shapes_via_project_insert" on public.shapes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = shapes.project_id
        and p.owner_id = auth.uid()
    ) or public.is_admin()
  );

create policy "shapes_via_project_update" on public.shapes
  for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = shapes.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = shapes.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

-- ⚠️ ปลดล็อก: owner ลบ shapes ของตัวเองได้ (เดิม admin เท่านั้น)
-- เพราะ save flow ใช้ delete + insert เพื่อ sync — ถ้า owner ลบไม่ได้จะ save ไม่ผ่าน
create policy "shapes_via_project_delete" on public.shapes
  for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = shapes.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 10. boq_items policies
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "boq_via_project_select"   on public.boq_items;
drop policy if exists "boq_via_project_insert"   on public.boq_items;
drop policy if exists "boq_via_project_update"   on public.boq_items;
drop policy if exists "boq_via_project_delete"   on public.boq_items;
drop policy if exists "boq_admin_delete"         on public.boq_items;

create policy "boq_via_project_select" on public.boq_items
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = boq_items.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "boq_via_project_insert" on public.boq_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = boq_items.project_id
        and p.owner_id = auth.uid()
    ) or public.is_admin()
  );

create policy "boq_via_project_update" on public.boq_items
  for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = boq_items.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = boq_items.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

-- ⚠️ owner ลบ BOQ ของตัวเองได้ (เหตุผลเดียวกับ shapes)
create policy "boq_via_project_delete" on public.boq_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = boq_items.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 11. ai_analyses policies (read-only ฝั่ง user, insert ผ่าน Edge Function)
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "ai_select_via_project" on public.ai_analyses;

create policy "ai_select_via_project" on public.ai_analyses
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = ai_analyses.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 12. material_prices policies (อ่านทั้งหมด, เขียนเฉพาะ admin)
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "material_prices_read_all"    on public.material_prices;
drop policy if exists "material_prices_admin_write" on public.material_prices;

create policy "material_prices_read_all" on public.material_prices
  for select to authenticated
  using (true);

create policy "material_prices_admin_write" on public.material_prices
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- 13. delete_requests policies
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "delete_req_select_self_or_admin" on public.delete_requests;
drop policy if exists "delete_req_insert_self"          on public.delete_requests;
drop policy if exists "delete_req_admin_update"         on public.delete_requests;

create policy "delete_req_select_self_or_admin" on public.delete_requests
  for select to authenticated
  using (auth.uid() = requester_id or public.is_admin());

create policy "delete_req_insert_self" on public.delete_requests
  for insert to authenticated
  with check (auth.uid() = requester_id);

create policy "delete_req_admin_update" on public.delete_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- 14. Storage bucket 'drawings' + RLS
-- ═══════════════════════════════════════════════════════════════════════
-- path convention: drawings/{project_id}/{file_id}/{original_name}

insert into storage.buckets (id, name, public)
values ('drawings', 'drawings', false)
on conflict (id) do nothing;

drop policy if exists "drawings_owner_select" on storage.objects;
drop policy if exists "drawings_owner_insert" on storage.objects;
drop policy if exists "drawings_owner_update" on storage.objects;
drop policy if exists "drawings_admin_delete" on storage.objects;
drop policy if exists "drawings_owner_delete" on storage.objects;

create policy "drawings_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'drawings'
    and (
      public.is_admin()
      or exists (
        select 1 from public.projects p
        where p.id::text = (storage.foldername(name))[1]
          and p.owner_id = auth.uid()
      )
    )
  );

create policy "drawings_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'drawings'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.owner_id = auth.uid()
    )
  );

create policy "drawings_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'drawings'
    and (
      public.is_admin()
      or exists (
        select 1 from public.projects p
        where p.id::text = (storage.foldername(name))[1]
          and p.owner_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'drawings'
    and (
      public.is_admin()
      or exists (
        select 1 from public.projects p
        where p.id::text = (storage.foldername(name))[1]
          and p.owner_id = auth.uid()
      )
    )
  );

-- ⚠️ owner ลบไฟล์ของตัวเองได้ (เดิม admin เท่านั้น) — จำเป็นเวลา re-upload
create policy "drawings_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'drawings'
    and (
      public.is_admin()
      or exists (
        select 1 from public.projects p
        where p.id::text = (storage.foldername(name))[1]
          and p.owner_id = auth.uid()
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- จบ fix-rls-policies.sql
-- ═══════════════════════════════════════════════════════════════════════
-- หลังรันสคริปต์นี้:
--   1. ลอง refresh app + กดบันทึกใหม่
--   2. ถ้ายัง error: เปิด console (F12) → ดู [supabase] diagnostic
--   3. ถ้ามี project ที่ owner_id เป็นของบัญชีอื่น ให้ลบทิ้งหรือเปลี่ยน owner ใน DB:
--      update public.projects set owner_id = auth.uid() where id = '<project-id>';
-- ═══════════════════════════════════════════════════════════════════════
