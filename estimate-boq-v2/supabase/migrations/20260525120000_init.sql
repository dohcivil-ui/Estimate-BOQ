-- ═══════════════════════════════════════════════════════════════════════
-- Estimate-BOQ v2 (Track B) — Initial Schema
-- ═══════════════════════════════════════════════════════════════════════
-- ครอบคลุม:
--   1. extension uuid + citext
--   2. user_role enum + profiles table (extends auth.users) + RBAC trigger
--   3. projects, drawing_pages, shapes, boq_items, ai_analyses, material_prices, delete_requests
--   4. RLS policies ทุก table (admin override + user owns project)
--   5. updated_at trigger ทุก table
-- ═══════════════════════════════════════════════════════════════════════
-- หลักการ RBAC:
--   - admin = ทำได้ทุกอย่าง (รวมลบ + เปลี่ยน role คนอื่น)
--   - user  = read/write เฉพาะข้อมูลของตัวเอง; ลบไม่ได้ ต้องส่ง delete_request
--   - คนแรกที่สมัครจะเป็น user → ผู้ดูแลต้องไป SET role='admin' ใน SQL
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Extensions ─────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "citext";

-- ─── 2. Roles enum ─────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'user');
  end if;
end$$;

-- ─── 3. Common helper: updated_at trigger ──────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- profiles (extends auth.users)
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       citext not null,
  full_name   text,
  avatar_url  text,
  role        public.user_role not null default 'user',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- helper: ตรวจว่า user ปัจจุบันเป็น admin หรือไม่ (ใช้ใน RLS)
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

-- ─── trigger: auto-create profile เมื่อ signup ─────────────────────────
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

-- ═══════════════════════════════════════════════════════════════════════
-- projects — โปรเจกต์ของผู้ใช้
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.projects (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  client      text,
  location    text,
  province    text,
  factor_f    numeric(6, 4),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_projects_owner on public.projects(owner_id);

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- drawing_pages — หน้าแบบ (PDF/JPG) ของแต่ละโปรเจกต์
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.drawing_pages (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  page_index    int not null,
  title         text,
  storage_path  text,                       -- path ใน Supabase Storage
  width_px      int,
  height_px     int,
  scale_value   numeric(12, 6),             -- unitPerPixel (m/px)
  rotation_deg  numeric(6, 3) default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (project_id, page_index)
);

create index if not exists idx_drawing_pages_project on public.drawing_pages(project_id);

drop trigger if exists trg_drawing_pages_updated_at on public.drawing_pages;
create trigger trg_drawing_pages_updated_at
  before update on public.drawing_pages
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- shapes — รูปวาด/เครื่องหมายวัดด้วยมือ
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.shapes (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  page_id     uuid references public.drawing_pages(id) on delete cascade,
  type        text not null check (type in ('line', 'polyline', 'polygon', 'rect', 'count', 'scale')),
  name        text,
  layer       text,
  points_json jsonb not null,                -- [{x,y}, ...] page coordinate
  area_m2     numeric(14, 4),
  length_m    numeric(14, 4),
  count_n     int,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_shapes_project on public.shapes(project_id);
create index if not exists idx_shapes_page on public.shapes(page_id);

drop trigger if exists trg_shapes_updated_at on public.shapes;
create trigger trg_shapes_updated_at
  before update on public.shapes
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- boq_items — รายการในตาราง BOQ
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.boq_items (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  category      text,                        -- 'งานโครงสร้าง', 'งานสถาปัตย์', ฯลฯ
  name          text not null,
  unit          text not null,
  quantity      numeric(14, 4) not null default 0,
  unit_price    numeric(14, 2) not null default 0,
  is_material   boolean not null default false,
  waste_pct     numeric(6, 2) not null default 0,
  thickness_m   numeric(8, 4),
  source        text not null default 'manual' check (source in ('manual', 'ai', 'measurement', 'import')),
  source_ref    uuid,                        -- ชี้กลับไป ai_analyses.id หรือ shapes.id
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_boq_project on public.boq_items(project_id);
create index if not exists idx_boq_source on public.boq_items(source);

drop trigger if exists trg_boq_items_updated_at on public.boq_items;
create trigger trg_boq_items_updated_at
  before update on public.boq_items
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- ai_analyses — log การเรียก Claude API
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.ai_analyses (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  page_id       uuid references public.drawing_pages(id) on delete cascade,
  model         text not null default 'claude-sonnet-4',
  prompt        text,
  response_json jsonb,
  status        text not null default 'pending' check (status in ('pending', 'success', 'error', 'cancelled')),
  error_msg     text,
  tokens_in     int,
  tokens_out    int,
  cost_usd      numeric(10, 4),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ai_project on public.ai_analyses(project_id);
create index if not exists idx_ai_status on public.ai_analyses(status);

-- ═══════════════════════════════════════════════════════════════════════
-- material_prices — ราคาวัสดุไกด์รายจังหวัด (global, admin-managed)
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.material_prices (
  id          uuid primary key default uuid_generate_v4(),
  province    text not null,
  item        text not null,
  unit        text not null,
  price       numeric(14, 2) not null,
  source      text,                          -- เช่น 'สนค.', 'manual'
  fetched_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (province, item, unit)
);

create index if not exists idx_material_prices_lookup on public.material_prices(province, item);

drop trigger if exists trg_material_prices_updated_at on public.material_prices;
create trigger trg_material_prices_updated_at
  before update on public.material_prices
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- delete_requests — user ส่งคำขอลบ → admin อนุมัติ
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.delete_requests (
  id           uuid primary key default uuid_generate_v4(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  item_type    text not null check (item_type in ('project', 'drawing_page', 'shape', 'boq_item')),
  item_id      uuid not null,
  reason       text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_delete_requests_status on public.delete_requests(status);
create index if not exists idx_delete_requests_requester on public.delete_requests(requester_id);

-- ═══════════════════════════════════════════════════════════════════════
-- RLS — เปิดทุก table
-- ═══════════════════════════════════════════════════════════════════════
alter table public.profiles         enable row level security;
alter table public.projects         enable row level security;
alter table public.drawing_pages    enable row level security;
alter table public.shapes           enable row level security;
alter table public.boq_items        enable row level security;
alter table public.ai_analyses      enable row level security;
alter table public.material_prices  enable row level security;
alter table public.delete_requests  enable row level security;

-- ─── profiles ──────────────────────────────────────────────────────────
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- user แก้ role ตัวเองไม่ได้ — ต้องให้ admin แก้
    and role = (select role from public.profiles where id = auth.uid())
  );

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── projects ──────────────────────────────────────────────────────────
drop policy if exists "projects_owner_or_admin_select" on public.projects;
create policy "projects_owner_or_admin_select" on public.projects
  for select using (auth.uid() = owner_id or public.is_admin());

drop policy if exists "projects_owner_insert" on public.projects;
create policy "projects_owner_insert" on public.projects
  for insert with check (auth.uid() = owner_id);

drop policy if exists "projects_owner_or_admin_update" on public.projects;
create policy "projects_owner_or_admin_update" on public.projects
  for update using (auth.uid() = owner_id or public.is_admin())
  with check (auth.uid() = owner_id or public.is_admin());

-- ลบได้เฉพาะ admin
drop policy if exists "projects_admin_delete" on public.projects;
create policy "projects_admin_delete" on public.projects
  for delete using (public.is_admin());

-- ─── drawing_pages (อ้างอิงจาก project owner) ─────────────────────────
drop policy if exists "drawing_pages_via_project" on public.drawing_pages;
create policy "drawing_pages_via_project" on public.drawing_pages
  for all
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

-- ─── shapes ────────────────────────────────────────────────────────────
drop policy if exists "shapes_via_project_rw" on public.shapes;
create policy "shapes_via_project_rw" on public.shapes
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = shapes.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "shapes_via_project_insert" on public.shapes;
create policy "shapes_via_project_insert" on public.shapes
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = shapes.project_id and p.owner_id = auth.uid()
    ) or public.is_admin()
  );

drop policy if exists "shapes_via_project_update" on public.shapes;
create policy "shapes_via_project_update" on public.shapes
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = shapes.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "shapes_admin_delete" on public.shapes;
create policy "shapes_admin_delete" on public.shapes
  for delete using (public.is_admin());

-- ─── boq_items ─────────────────────────────────────────────────────────
drop policy if exists "boq_via_project_select" on public.boq_items;
create policy "boq_via_project_select" on public.boq_items
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = boq_items.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "boq_via_project_insert" on public.boq_items;
create policy "boq_via_project_insert" on public.boq_items
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = boq_items.project_id and p.owner_id = auth.uid()
    ) or public.is_admin()
  );

drop policy if exists "boq_via_project_update" on public.boq_items;
create policy "boq_via_project_update" on public.boq_items
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = boq_items.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "boq_admin_delete" on public.boq_items;
create policy "boq_admin_delete" on public.boq_items
  for delete using (public.is_admin());

-- ─── ai_analyses (read-own via project; write ผ่าน Edge Function) ──────
drop policy if exists "ai_select_via_project" on public.ai_analyses;
create policy "ai_select_via_project" on public.ai_analyses
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = ai_analyses.project_id
        and (p.owner_id = auth.uid() or public.is_admin())
    )
  );

-- insert/update ของ ai_analyses ต้องผ่าน Edge Function (service role) เท่านั้น
-- ดังนั้นไม่มี policy insert/update สำหรับ anon/authenticated → block by default

-- ─── material_prices (อ่านทั้งหมด, แก้เฉพาะ admin) ────────────────────
drop policy if exists "material_prices_read_all" on public.material_prices;
create policy "material_prices_read_all" on public.material_prices
  for select using (auth.role() = 'authenticated');

drop policy if exists "material_prices_admin_write" on public.material_prices;
create policy "material_prices_admin_write" on public.material_prices
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── delete_requests ───────────────────────────────────────────────────
drop policy if exists "delete_req_select_self_or_admin" on public.delete_requests;
create policy "delete_req_select_self_or_admin" on public.delete_requests
  for select using (auth.uid() = requester_id or public.is_admin());

drop policy if exists "delete_req_insert_self" on public.delete_requests;
create policy "delete_req_insert_self" on public.delete_requests
  for insert with check (auth.uid() = requester_id);

drop policy if exists "delete_req_admin_update" on public.delete_requests;
create policy "delete_req_admin_update" on public.delete_requests
  for update using (public.is_admin()) with check (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- จบ migration init
-- ═══════════════════════════════════════════════════════════════════════
-- หลัง apply migration นี้:
--   1. ไปที่ Supabase Dashboard → Authentication → Providers → Google
--      เปิดใช้งานและใส่ Google OAuth Client ID / Secret
--   2. สมัครเข้า app ครั้งแรก จะได้ role='user' โดย default
--   3. ตั้งคนแรกเป็น admin (เปิด SQL Editor แล้วรัน):
--      update public.profiles set role='admin' where email='YOUR_EMAIL@gmail.com';
-- ═══════════════════════════════════════════════════════════════════════
