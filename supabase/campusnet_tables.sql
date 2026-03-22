-- ============================================================
-- CampusNet Import Tables
-- Run AFTER schema.sql
-- ============================================================

-- ─── Instructors ──────────────────────────────────────────────────────────────

create table if not exists instructors (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null unique,
  created_at timestamptz not null default now()
);

alter table instructors enable row level security;

create policy "Instructors: authenticated read"
  on instructors for select to authenticated using (true);

-- ─── Courses (deduplicated academic modules) ──────────────────────────────────

create table if not exists campusnet_courses (
  id             uuid        primary key default gen_random_uuid(),
  module_number  text,                    -- e.g. "CH-101"  (null if unnumbered)
  name           text        not null,
  source_url     text        not null,
  last_synced_at timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Numbered courses are unique by module_number.
-- Unnumbered courses are unique by name.
create unique index if not exists campusnet_courses_module_number_idx
  on campusnet_courses (module_number)
  where module_number is not null;

create unique index if not exists campusnet_courses_name_idx
  on campusnet_courses (name)
  where module_number is null;

alter table campusnet_courses enable row level security;

create policy "CampusNet courses: authenticated read"
  on campusnet_courses for select to authenticated using (true);

create trigger campusnet_courses_updated_at
  before update on campusnet_courses
  for each row execute function update_updated_at();

-- ─── Course Offerings (semester-specific components) ──────────────────────────

create table if not exists course_offerings (
  id               uuid        primary key default gen_random_uuid(),
  course_id        uuid        not null references campusnet_courses(id) on delete cascade,
  semester         text        not null,  -- "Spring 2023"
  offering_number  text,                  -- "CH-101-A"  (null if no sub-component)
  name             text        not null,
  course_type      text,                  -- "Lecture", "Lab", "Seminar", etc.
  source_url       text        not null,
  last_synced_at   timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists course_offerings_unique_idx
  on course_offerings (course_id, semester, coalesce(offering_number, name));

alter table course_offerings enable row level security;

create policy "Course offerings: authenticated read"
  on course_offerings for select to authenticated using (true);

create trigger course_offerings_updated_at
  before update on course_offerings
  for each row execute function update_updated_at();

-- ─── Course Offering Instructors (junction) ────────────────────────────────────

create table if not exists course_offering_instructors (
  course_offering_id uuid not null references course_offerings(id)  on delete cascade,
  instructor_id      uuid not null references instructors(id)        on delete cascade,
  primary key (course_offering_id, instructor_id)
);

alter table course_offering_instructors enable row level security;

create policy "Course offering instructors: authenticated read"
  on course_offering_instructors for select to authenticated using (true);
