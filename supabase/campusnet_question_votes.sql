-- ============================================================
-- CampusNet Question Votes
-- Run AFTER campusnet_resources_questions.sql
-- ============================================================

create table if not exists campusnet_question_votes (
  question_id uuid     not null references campusnet_course_questions(id) on delete cascade,
  user_id     uuid     not null references profiles(id)                   on delete cascade,
  vote        smallint not null check (vote in (1, -1)),
  primary key (question_id, user_id)
);

alter table campusnet_question_votes enable row level security;

create policy "CampusNet question votes: authenticated read"
  on campusnet_question_votes for select to authenticated using (true);

create policy "CampusNet question votes: own insert"
  on campusnet_question_votes for insert with check (user_id = auth.uid());

create policy "CampusNet question votes: own update"
  on campusnet_question_votes for update using (user_id = auth.uid());

create policy "CampusNet question votes: own delete"
  on campusnet_question_votes for delete using (user_id = auth.uid());
