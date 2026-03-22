-- ============================================================
-- Programs table
-- Run AFTER schema.sql
-- ============================================================

create type program_level as enum ('bachelor', 'master');

create table if not exists programs (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null unique,
  level       program_level not null,
  school      text,
  source_url  text        not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Unique constraint: one row per name+level pair
alter table programs
  add constraint programs_name_level_unique unique (name, level);

-- Auto-update updated_at
create trigger programs_updated_at
  before update on programs
  for each row execute function update_updated_at();

-- RLS
alter table programs enable row level security;

-- Anyone authenticated can read programs (they are university-wide reference data)
create policy "Programs: authenticated read"
  on programs for select
  to authenticated
  using (true);
