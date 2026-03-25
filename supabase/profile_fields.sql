-- ============================================================
-- Profile extra fields: graduation_year + interests
-- Run in Supabase SQL editor
-- ============================================================

alter table profiles add column if not exists graduation_year smallint;
alter table profiles add column if not exists interests text[] not null default '{}';
