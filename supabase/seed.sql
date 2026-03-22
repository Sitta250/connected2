-- ============================================================
-- Connected – Seed Data
-- Run AFTER schema.sql
-- ============================================================

-- Constructor University (the only approved institution for this MVP)
insert into universities (name, domain)
values ('Constructor University', 'constructor.university')
on conflict (domain) do nothing;
