-- ============================================================
-- Connected – Full Database Schema + RLS Policies
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

-- ─── Enums ────────────────────────────────────────────────────────────────────

create type year_of_study as enum ('1', '2', '3', '4', 'masters', 'phd');
create type club_role      as enum ('member', 'officer', 'president');
create type item_condition as enum ('new', 'like_new', 'good', 'fair', 'poor');
create type resource_type  as enum ('notes', 'past_exam', 'slides', 'other');

-- ─── Universities ─────────────────────────────────────────────────────────────

create table universities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  domain     text not null unique,   -- e.g. "constructor.university"
  logo_url   text,
  created_at timestamptz default now()
);

alter table universities enable row level security;

-- Everyone (even unauthenticated) can read universities so the signup page
-- can validate domain without being signed in.
create policy "Universities: public read"
  on universities for select using (true);

-- ─── Profiles ─────────────────────────────────────────────────────────────────
-- Created automatically in /auth/callback after email confirmation.
-- onboarding_complete is set to true at the end of the onboarding form.

create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  university_id       uuid references universities(id) on delete set null,
  university_email    text not null,
  full_name           text not null default '',
  faculty             text,
  major               text,
  year_of_study       year_of_study,
  avatar_url          text,
  onboarding_complete boolean not null default false,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table profiles enable row level security;

-- Users can always read and write their own profile.
create policy "Profiles: own read"
  on profiles for select using (id = auth.uid());

create policy "Profiles: own insert"
  on profiles for insert with check (id = auth.uid());

create policy "Profiles: own update"
  on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Users in the same university can read each other's profiles.
create policy "Profiles: same-university read"
  on profiles for select
  using (
    university_id = (
      select university_id from profiles where id = auth.uid()
    )
  );

-- Auto-update updated_at on any change.
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- ─── Courses ──────────────────────────────────────────────────────────────────

create table courses (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  code          text not null,
  title         text not null,
  description   text,
  department    text,
  credits       int,
  professor     text,
  created_at    timestamptz default now(),
  unique(university_id, code)
);

create index courses_university_idx on courses(university_id);
create index courses_code_trgm_idx  on courses using gin(code  gin_trgm_ops);
create index courses_title_trgm_idx on courses using gin(title gin_trgm_ops);

alter table courses enable row level security;

create policy "Courses: same-university read"
  on courses for select
  using (
    university_id = (select university_id from profiles where id = auth.uid())
  );

-- ─── Course Reviews ───────────────────────────────────────────────────────────

create table course_reviews (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references courses(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  rating          int  not null check (rating between 1 and 5),
  difficulty      int  not null check (difficulty between 1 and 5),
  body            text not null,
  grade           text,
  semester        text,
  would_recommend boolean default true,
  created_at      timestamptz default now(),
  unique(course_id, user_id)
);

alter table course_reviews enable row level security;

create policy "Reviews: same-university read"
  on course_reviews for select
  using (
    exists (
      select 1 from courses c
      join profiles p on p.university_id = c.university_id
      where c.id = course_reviews.course_id and p.id = auth.uid()
    )
  );

create policy "Reviews: own insert" on course_reviews for insert with check (user_id = auth.uid());
create policy "Reviews: own update" on course_reviews for update using (user_id = auth.uid());
create policy "Reviews: own delete" on course_reviews for delete using (user_id = auth.uid());

-- ─── Course Q&A ───────────────────────────────────────────────────────────────

create table course_questions (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text not null,
  body        text,
  is_resolved boolean default false,
  created_at  timestamptz default now()
);

create table course_answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references course_questions(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  body        text not null,
  is_accepted boolean default false,
  created_at  timestamptz default now()
);

alter table course_questions enable row level security;
alter table course_answers   enable row level security;

create policy "Questions: same-university read"
  on course_questions for select
  using (
    exists (
      select 1 from courses c
      join profiles p on p.university_id = c.university_id
      where c.id = course_questions.course_id and p.id = auth.uid()
    )
  );
create policy "Questions: own insert" on course_questions for insert with check (user_id = auth.uid());
create policy "Questions: own update" on course_questions for update using (user_id = auth.uid());

create policy "Answers: same-university read"
  on course_answers for select
  using (
    exists (
      select 1 from course_questions q
      join courses c on c.id = q.course_id
      join profiles p on p.university_id = c.university_id
      where q.id = course_answers.question_id and p.id = auth.uid()
    )
  );
create policy "Answers: own insert" on course_answers for insert with check (user_id = auth.uid());
create policy "Answers: own update" on course_answers for update using (user_id = auth.uid());

-- ─── Course Resources ─────────────────────────────────────────────────────────

create table course_resources (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text not null,
  description text,
  file_url    text,
  type        resource_type not null default 'other',
  created_at  timestamptz default now()
);

alter table course_resources enable row level security;

create policy "Resources: same-university read"
  on course_resources for select
  using (
    exists (
      select 1 from courses c
      join profiles p on p.university_id = c.university_id
      where c.id = course_resources.course_id and p.id = auth.uid()
    )
  );
create policy "Resources: own insert" on course_resources for insert with check (user_id = auth.uid());
create policy "Resources: own delete" on course_resources for delete using (user_id = auth.uid());

-- ─── Clubs ────────────────────────────────────────────────────────────────────

create table clubs (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  name          text not null,
  description   text,
  category      text,
  logo_url      text,
  cover_url     text,
  member_count  int  default 0,
  is_verified   boolean default false,
  created_at    timestamptz default now()
);

create index clubs_university_idx on clubs(university_id);
create index clubs_name_trgm_idx  on clubs using gin(name gin_trgm_ops);

alter table clubs enable row level security;

create policy "Clubs: same-university read"
  on clubs for select
  using (
    university_id = (select university_id from profiles where id = auth.uid())
  );

-- ─── Club Members ─────────────────────────────────────────────────────────────

create table club_members (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references clubs(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      club_role default 'member',
  joined_at timestamptz default now(),
  unique(club_id, user_id)
);

alter table club_members enable row level security;

create policy "Club members: same-university read"
  on club_members for select
  using (
    exists (
      select 1 from clubs c
      join profiles p on p.university_id = c.university_id
      where c.id = club_members.club_id and p.id = auth.uid()
    )
  );
create policy "Club members: own insert" on club_members for insert with check (user_id = auth.uid());
create policy "Club members: own delete" on club_members for delete using (user_id = auth.uid());

create or replace function update_club_member_count()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update clubs set member_count = member_count + 1 where id = new.club_id;
  elsif (tg_op = 'DELETE') then
    update clubs set member_count = greatest(member_count - 1, 0) where id = old.club_id;
  end if;
  return null;
end;
$$;

create trigger club_member_count_trigger
  after insert or delete on club_members
  for each row execute function update_club_member_count();

-- ─── Club Posts & Comments ────────────────────────────────────────────────────

create table club_posts (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references clubs(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  title         text,
  body          text not null,
  like_count    int  default 0,
  comment_count int  default 0,
  created_at    timestamptz default now()
);

create table club_post_likes (
  post_id    uuid not null references club_posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

create table club_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references club_posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);

alter table club_posts      enable row level security;
alter table club_post_likes enable row level security;
alter table club_comments   enable row level security;

create policy "Club posts: same-university read"
  on club_posts for select
  using (
    exists (
      select 1 from clubs c
      join profiles p on p.university_id = c.university_id
      where c.id = club_posts.club_id and p.id = auth.uid()
    )
  );
create policy "Club posts: members insert"
  on club_posts for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from club_members
      where club_id = club_posts.club_id and user_id = auth.uid()
    )
  );
create policy "Club posts: own delete" on club_posts for delete using (user_id = auth.uid());

create policy "Post likes: read"   on club_post_likes for select using (true);
create policy "Post likes: own insert" on club_post_likes for insert with check (user_id = auth.uid());
create policy "Post likes: own delete" on club_post_likes for delete using (user_id = auth.uid());

create policy "Club comments: same-university read"
  on club_comments for select
  using (
    exists (
      select 1 from club_posts po
      join clubs c on c.id = po.club_id
      join profiles p on p.university_id = c.university_id
      where po.id = club_comments.post_id and p.id = auth.uid()
    )
  );
create policy "Club comments: own insert" on club_comments for insert with check (user_id = auth.uid());
create policy "Club comments: own delete" on club_comments for delete using (user_id = auth.uid());

-- ─── Marketplace ──────────────────────────────────────────────────────────────

create table marketplace_listings (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references profiles(id) on delete cascade,
  university_id uuid not null references universities(id) on delete cascade,
  title         text not null,
  description   text,
  price         numeric(10,2),
  condition     item_condition,
  category      text,
  images        text[] default '{}',
  is_sold       boolean default false,
  is_free       boolean default false,
  created_at    timestamptz default now()
);

create index marketplace_university_idx on marketplace_listings(university_id);

alter table marketplace_listings enable row level security;

create policy "Listings: same-university read"
  on marketplace_listings for select
  using (
    university_id = (select university_id from profiles where id = auth.uid())
  );
create policy "Listings: own insert"
  on marketplace_listings for insert
  with check (
    seller_id = auth.uid()
    and university_id = (select university_id from profiles where id = auth.uid())
  );
create policy "Listings: own update" on marketplace_listings for update using (seller_id = auth.uid());
create policy "Listings: own delete" on marketplace_listings for delete using (seller_id = auth.uid());

-- ─── Marketplace Messages ─────────────────────────────────────────────────────

create table marketplace_messages (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references marketplace_listings(id) on delete cascade,
  sender_id   uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  body        text not null,
  is_read     boolean default false,
  created_at  timestamptz default now()
);

alter table marketplace_messages enable row level security;

create policy "Messages: participants read"
  on marketplace_messages for select using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "Messages: own send"
  on marketplace_messages for insert with check (sender_id = auth.uid());
create policy "Messages: receiver mark-read"
  on marketplace_messages for update using (receiver_id = auth.uid());

-- ─── Events ───────────────────────────────────────────────────────────────────

create table events (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  club_id       uuid references clubs(id) on delete set null,
  creator_id    uuid references profiles(id) on delete set null,
  title         text not null,
  description   text,
  location      text,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  image_url     text,
  category      text,
  rsvp_count    int  default 0,
  created_at    timestamptz default now()
);

create table event_rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(event_id, user_id)
);

alter table events      enable row level security;
alter table event_rsvps enable row level security;

create policy "Events: same-university read"
  on events for select
  using (
    university_id = (select university_id from profiles where id = auth.uid())
  );
create policy "Events: own insert"
  on events for insert
  with check (
    creator_id = auth.uid()
    and university_id = (select university_id from profiles where id = auth.uid())
  );

create policy "Event RSVPs: read"       on event_rsvps for select using (true);
create policy "Event RSVPs: own insert" on event_rsvps for insert with check (user_id = auth.uid());
create policy "Event RSVPs: own delete" on event_rsvps for delete using (user_id = auth.uid());

create or replace function update_event_rsvp_count()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update events set rsvp_count = rsvp_count + 1 where id = new.event_id;
  elsif (tg_op = 'DELETE') then
    update events set rsvp_count = greatest(rsvp_count - 1, 0) where id = old.event_id;
  end if;
  return null;
end;
$$;

create trigger event_rsvp_count_trigger
  after insert or delete on event_rsvps
  for each row execute function update_event_rsvp_count();

-- ─── News ─────────────────────────────────────────────────────────────────────

create table news_articles (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  author_id     uuid references profiles(id) on delete set null,
  title         text not null,
  body          text not null,
  image_url     text,
  category      text,
  published_at  timestamptz default now(),
  created_at    timestamptz default now()
);

alter table news_articles enable row level security;

create policy "News: same-university read"
  on news_articles for select
  using (
    university_id = (select university_id from profiles where id = auth.uid())
  );

-- ─── Realtime ─────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table marketplace_messages;
alter publication supabase_realtime add table club_posts;
alter publication supabase_realtime add table club_comments;
