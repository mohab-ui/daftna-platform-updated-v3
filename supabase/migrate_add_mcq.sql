-- =========
-- Migration: Add MCQ system (Question bank + Quizzes + Answers)
-- Safe to run on existing projects.
-- =========

-- 1) MCQ Questions (Question Bank)
create table if not exists public.mcq_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lecture_id uuid references public.lectures(id) on delete set null,
  question_text text not null,
  choices jsonb not null,         -- array of strings
  correct_index int not null check (correct_index >= 0 and correct_index <= 5),
  explanation text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists mcq_questions_course_idx on public.mcq_questions(course_id);
create index if not exists mcq_questions_lecture_idx on public.mcq_questions(lecture_id);

-- 2) Quizzes (Attempts)
create table if not exists public.mcq_quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lecture_id uuid references public.lectures(id) on delete set null,
  mode text not null default 'practice' check (mode in ('practice','exam')),
  total_questions int not null default 0 check (total_questions >= 0),
  correct_count int not null default 0 check (correct_count >= 0),
  score int not null default 0 check (score >= 0 and score <= 100),
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists mcq_quizzes_user_idx on public.mcq_quizzes(user_id);
create index if not exists mcq_quizzes_course_idx on public.mcq_quizzes(course_id);
create index if not exists mcq_quizzes_submitted_idx on public.mcq_quizzes(submitted_at);

-- 3) Quiz Questions (the drawn questions in this attempt)
create table if not exists public.mcq_quiz_questions (
  quiz_id uuid not null references public.mcq_quizzes(id) on delete cascade,
  question_id uuid not null references public.mcq_questions(id) on delete restrict,
  order_index int not null default 0,
  primary key (quiz_id, question_id)
);

create index if not exists mcq_quiz_questions_quiz_idx on public.mcq_quiz_questions(quiz_id);

-- 4) Quiz Answers
create table if not exists public.mcq_quiz_answers (
  quiz_id uuid not null references public.mcq_quizzes(id) on delete cascade,
  question_id uuid not null references public.mcq_questions(id) on delete restrict,
  selected_index int, -- nullable until answered
  is_correct boolean not null default false,
  answered_at timestamptz not null default now(),
  primary key (quiz_id, question_id)
);

create index if not exists mcq_quiz_answers_quiz_idx on public.mcq_quiz_answers(quiz_id);

-- 5) RLS
alter table public.mcq_questions enable row level security;
alter table public.mcq_quizzes enable row level security;
alter table public.mcq_quiz_questions enable row level security;
alter table public.mcq_quiz_answers enable row level security;

-- ===== Policies =====

-- QUESTIONS: everyone authenticated can read, moderators can write
drop policy if exists "mcq_questions_select_auth" on public.mcq_questions;
create policy "mcq_questions_select_auth"
on public.mcq_questions for select
to authenticated
using (true);

drop policy if exists "mcq_questions_insert_mod" on public.mcq_questions;
create policy "mcq_questions_insert_mod"
on public.mcq_questions for insert
to authenticated
with check (public.is_moderator() and created_by = auth.uid());

drop policy if exists "mcq_questions_update_mod" on public.mcq_questions;
create policy "mcq_questions_update_mod"
on public.mcq_questions for update
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

drop policy if exists "mcq_questions_delete_mod" on public.mcq_questions;
create policy "mcq_questions_delete_mod"
on public.mcq_questions for delete
to authenticated
using (public.is_moderator());

-- QUIZZES: user can read/write own quizzes, moderators can see all
drop policy if exists "mcq_quizzes_select_own" on public.mcq_quizzes;
create policy "mcq_quizzes_select_own"
on public.mcq_quizzes for select
to authenticated
using (user_id = auth.uid() or public.is_moderator());

drop policy if exists "mcq_quizzes_insert_own" on public.mcq_quizzes;
create policy "mcq_quizzes_insert_own"
on public.mcq_quizzes for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "mcq_quizzes_update_own" on public.mcq_quizzes;
create policy "mcq_quizzes_update_own"
on public.mcq_quizzes for update
to authenticated
using (user_id = auth.uid() or public.is_moderator())
with check (user_id = auth.uid() or public.is_moderator());

drop policy if exists "mcq_quizzes_delete_own" on public.mcq_quizzes;
create policy "mcq_quizzes_delete_own"
on public.mcq_quizzes for delete
to authenticated
using (user_id = auth.uid() or public.is_moderator());

-- QUIZ QUESTIONS: only owner (or moderator) can access
drop policy if exists "mcq_quiz_questions_select_owner" on public.mcq_quiz_questions;
create policy "mcq_quiz_questions_select_owner"
on public.mcq_quiz_questions for select
to authenticated
using (
  exists (
    select 1 from public.mcq_quizzes q
    where q.id = quiz_id
      and (q.user_id = auth.uid() or public.is_moderator())
  )
);

drop policy if exists "mcq_quiz_questions_insert_owner" on public.mcq_quiz_questions;
create policy "mcq_quiz_questions_insert_owner"
on public.mcq_quiz_questions for insert
to authenticated
with check (
  exists (
    select 1 from public.mcq_quizzes q
    where q.id = quiz_id
      and q.user_id = auth.uid()
  )
);

-- QUIZ ANSWERS: only owner (or moderator) can access
drop policy if exists "mcq_quiz_answers_select_owner" on public.mcq_quiz_answers;
create policy "mcq_quiz_answers_select_owner"
on public.mcq_quiz_answers for select
to authenticated
using (
  exists (
    select 1 from public.mcq_quizzes q
    where q.id = quiz_id
      and (q.user_id = auth.uid() or public.is_moderator())
  )
);

drop policy if exists "mcq_quiz_answers_upsert_owner" on public.mcq_quiz_answers;
create policy "mcq_quiz_answers_upsert_owner"
on public.mcq_quiz_answers for insert
to authenticated
with check (
  exists (
    select 1 from public.mcq_quizzes q
    where q.id = quiz_id
      and q.user_id = auth.uid()
  )
);

drop policy if exists "mcq_quiz_answers_update_owner" on public.mcq_quiz_answers;
create policy "mcq_quiz_answers_update_owner"
on public.mcq_quiz_answers for update
to authenticated
using (
  exists (
    select 1 from public.mcq_quizzes q
    where q.id = quiz_id
      and q.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.mcq_quizzes q
    where q.id = quiz_id
      and q.user_id = auth.uid()
  )
);
