create table if not exists detection_state (
  project_id uuid primary key references projects(id) on delete cascade,
  state_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table detection_state enable row level security;

create policy detection_state_select on detection_state for select using (
  exists (select 1 from projects p where p.id = detection_state.project_id
    and (p.owner_id = auth.uid() or public.is_admin())));

create policy detection_state_insert on detection_state for insert with check (
  exists (select 1 from projects p where p.id = detection_state.project_id
    and (p.owner_id = auth.uid() or public.is_admin())));

create policy detection_state_update on detection_state for update using (
  exists (select 1 from projects p where p.id = detection_state.project_id
    and (p.owner_id = auth.uid() or public.is_admin())));

create policy detection_state_delete on detection_state for delete using (
  exists (select 1 from projects p where p.id = detection_state.project_id
    and (p.owner_id = auth.uid() or public.is_admin())));