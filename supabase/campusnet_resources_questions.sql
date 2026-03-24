-- ============================================================
-- CampusNet Course Resources & Questions
-- Run AFTER campusnet_tables.sql
-- ============================================================

-- ─── Resources ────────────────────────────────────────────────────────────────

create table if not exists campusnet_course_resources (
  id          uuid        primary key default gen_random_uuid(),
  course_id   uuid        not null references campusnet_courses(id) on delete cascade,
  user_id     uuid        not null references profiles(id)          on delete cascade,
  title       text        not null,
  description text,
  file_url    text,
  type        text        not null default 'notes',
  created_at  timestamptz not null default now()
);

alter table campusnet_course_resources enable row level security;

create policy "CampusNet resources: authenticated read"
  on campusnet_course_resources for select to authenticated using (true);

create policy "CampusNet resources: own insert"
  on campusnet_course_resources for insert with check (user_id = auth.uid());

create policy "CampusNet resources: own delete"
  on campusnet_course_resources for delete using (user_id = auth.uid());

-- ─── Questions ────────────────────────────────────────────────────────────────

create table if not exists campusnet_course_questions (
  id          uuid        primary key default gen_random_uuid(),
  course_id   uuid        not null references campusnet_courses(id) on delete cascade,
  user_id     uuid        not null references profiles(id)          on delete cascade,
  title       text        not null,
  body        text,
  is_resolved boolean     not null default false,
  created_at  timestamptz not null default now()
);

alter table campusnet_course_questions enable row level security;

create policy "CampusNet questions: authenticated read"
  on campusnet_course_questions for select to authenticated using (true);

create policy "CampusNet questions: own insert"
  on campusnet_course_questions for insert with check (user_id = auth.uid());

create policy "CampusNet questions: own update"
  on campusnet_course_questions for update using (user_id = auth.uid());

create policy "CampusNet questions: own delete"
  on campusnet_course_questions for delete using (user_id = auth.uid());
