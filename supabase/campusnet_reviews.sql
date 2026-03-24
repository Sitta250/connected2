-- ============================================================
-- CampusNet Course Reviews
-- Run AFTER campusnet_tables.sql
-- ============================================================

create type exam_type     as enum ('paper', 'online', 'project', 'presentation', 'other');
create type workload_level as enum ('light', 'moderate', 'heavy', 'very_heavy');

create table if not exists campusnet_course_reviews (
  id               uuid          primary key default gen_random_uuid(),
  course_id        uuid          not null references campusnet_courses(id) on delete cascade,
  user_id          uuid          not null references profiles(id)          on delete cascade,
  rating           int           not null check (rating between 1 and 5),
  difficulty       int           not null check (difficulty between 1 and 5),
  workload         workload_level not null,
  exam_type        exam_type     not null,
  exam_type_other  text,                       -- filled when exam_type = 'other'
  body             text          not null,
  pros             text,
  cons             text,
  tips             text,
  grade            text,                       -- "A", "B+", ... or "in_progress"
  semester         text,
  would_recommend  boolean       not null default true,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  unique(course_id, user_id)
);

alter table campusnet_course_reviews enable row level security;

-- Same-university read
create policy "CampusNet reviews: authenticated read"
  on campusnet_course_reviews for select to authenticated using (true);

-- Own write / edit / delete
create policy "CampusNet reviews: own insert"
  on campusnet_course_reviews for insert with check (user_id = auth.uid());

create policy "CampusNet reviews: own update"
  on campusnet_course_reviews for update using (user_id = auth.uid());

create policy "CampusNet reviews: own delete"
  on campusnet_course_reviews for delete using (user_id = auth.uid());

create trigger campusnet_course_reviews_updated_at
  before update on campusnet_course_reviews
  for each row execute function update_updated_at();
