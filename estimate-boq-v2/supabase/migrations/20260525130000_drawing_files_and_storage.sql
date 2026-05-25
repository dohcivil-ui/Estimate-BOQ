-- ═══════════════════════════════════════════════════════════════════════
-- Step 2.6 — Drawing files + Storage policies
-- ═══════════════════════════════════════════════════════════════════════
-- ทำให้:
--   1. มีตาราง drawing_files แยกจาก drawing_pages (1 file = N pages)
--   2. drawing_pages.file_id FK + drop storage_path (ย้ายไปอยู่ที่ file)
--   3. Storage bucket 'drawings' + RLS policies ตาม project ownership
-- ═══════════════════════════════════════════════════════════════════════

-- ─── drawing_files ─────────────────────────────────────────────────────
create table if not exists public.drawing_files (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  name          text not null,
  source_type   text not null check (source_type in ('pdf', 'image')),
  page_count    int not null default 1,
  file_size     bigint,
  /** path ใน Supabase Storage bucket 'drawings' — เช่น "{project_id}/{file_id}/{name}" */
  storage_path  text not null,
  imported_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_drawing_files_project on public.drawing_files(project_id);

drop trigger if exists trg_drawing_files_updated_at on public.drawing_files;
create trigger trg_drawing_files_updated_at
  before update on public.drawing_files
  for each row execute function public.set_updated_at();

-- ─── drawing_pages: เพิ่ม file_id FK ───────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'drawing_pages' and column_name = 'file_id'
  ) then
    alter table public.drawing_pages
      add column file_id uuid references public.drawing_files(id) on delete cascade;
    create index if not exists idx_drawing_pages_file on public.drawing_pages(file_id);
  end if;
end$$;

-- ─── drawing_pages: drop legacy storage_path (ย้ายไป drawing_files) ───
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'drawing_pages' and column_name = 'storage_path'
  ) then
    alter table public.drawing_pages drop column storage_path;
  end if;
end$$;

-- ─── RLS: drawing_files ────────────────────────────────────────────────
alter table public.drawing_files enable row level security;

drop policy if exists "drawing_files_via_project" on public.drawing_files;
create policy "drawing_files_via_project" on public.drawing_files
  for all
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

-- ═══════════════════════════════════════════════════════════════════════
-- Storage bucket 'drawings' + RLS policies
-- ═══════════════════════════════════════════════════════════════════════
-- path convention: drawings/{project_id}/{file_id}/{original_name}
-- ผู้ใช้ของ project นั้น (หรือ admin) เท่านั้นที่ select/insert/update/delete ได้
-- ═══════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('drawings', 'drawings', false)
on conflict (id) do nothing;

-- helper: ดึง project_id (= path segment ที่ 1) จาก path ของ storage.objects.name
-- storage.foldername(name) คืน array ของแต่ละ folder; [1] = ตัวแรก
-- เช่น "abcd-1234/file-5678/plan.pdf" → "abcd-1234"

drop policy if exists "drawings_owner_select" on storage.objects;
create policy "drawings_owner_select" on storage.objects
  for select using (
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

drop policy if exists "drawings_owner_insert" on storage.objects;
create policy "drawings_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'drawings'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "drawings_owner_update" on storage.objects;
create policy "drawings_owner_update" on storage.objects
  for update using (
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

drop policy if exists "drawings_admin_delete" on storage.objects;
create policy "drawings_admin_delete" on storage.objects
  for delete using (
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
-- จบ migration step 2.6
-- ═══════════════════════════════════════════════════════════════════════
