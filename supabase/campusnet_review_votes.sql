-- ============================================================
-- CampusNet Review Votes
-- Run AFTER campusnet_reviews.sql
-- ============================================================

create table if not exists campusnet_review_votes (
  review_id  uuid     not null references campusnet_course_reviews(id) on delete cascade,
  user_id    uuid     not null references profiles(id)                 on delete cascade,
  vote       smallint not null check (vote in (1, -1)),
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

alter table campusnet_review_votes enable row level security;

create policy "Review votes: authenticated read"
  on campusnet_review_votes for select to authenticated using (true);

create policy "Review votes: own insert"
  on campusnet_review_votes for insert with check (user_id = auth.uid());

create policy "Review votes: own update"
  on campusnet_review_votes for update using (user_id = auth.uid());

create policy "Review votes: own delete"
  on campusnet_review_votes for delete using (user_id = auth.uid());
