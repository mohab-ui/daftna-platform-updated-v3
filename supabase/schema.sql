-- =========
-- Batch Hub schema (Supabase / Postgres)
-- =========

-- 1) Extensions
create extension if not exists "pgcrypto";

-- 2) Profiles: extend auth.users with role + full name
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'student' check (role in ('student', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

-- 3) Courses
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  semester int,
  description text,
  created_at timestamptz not null default now()
);

create unique index if not exists courses_code_unique on public.courses(code);

-- 4) Lectures (محاضرات/تقسيم داخلي للمادة)
create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists lectures_course_idx on public.lectures(course_id);
-- keep lecture numbers unique داخل كل مادة (يساعد في التنظيم)
create unique index if not exists lectures_course_order_unique on public.lectures(course_id, order_index);

-- 5) Resources
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lecture_id uuid references public.lectures(id) on delete set null,
  title text not null,
  type text not null,
  description text,
  storage_path text,   -- path inside Storage bucket (private)
  external_url text,   -- optional external link
  uploader_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resources_course_idx on public.resources(course_id);
create index if not exists resources_lecture_idx on public.resources(lecture_id);
create index if not exists resources_type_idx on public.resources(type);

-- 6) updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_resources_updated_at on public.resources;
create trigger trg_resources_updated_at
before update on public.resources
for each row execute function public.set_updated_at();

-- 7) Helper function for moderation checks
create or replace function public.is_moderator()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('moderator', 'admin')
  );
$$;

-- 7b) Safety: prevent students from changing their role
-- (SQL editor / service role has auth.uid() = null, so it won't be blocked)
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is null then
      return new;
    end if;

    if not public.is_moderator() then
      raise exception 'not allowed to change role';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_role_guard on public.profiles;
create trigger trg_profiles_role_guard
before update on public.profiles
for each row execute function public.guard_profile_role();

-- 8) Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lectures enable row level security;
alter table public.resources enable row level security;

-- PROFILES POLICIES
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- COURSES POLICIES
drop policy if exists "courses_select_auth" on public.courses;
create policy "courses_select_auth"
on public.courses for select
to authenticated
using (true);

drop policy if exists "courses_write_mod" on public.courses;
create policy "courses_write_mod"
on public.courses for insert
to authenticated
with check (public.is_moderator());

drop policy if exists "courses_update_mod" on public.courses;
create policy "courses_update_mod"
on public.courses for update
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

drop policy if exists "courses_delete_mod" on public.courses;
create policy "courses_delete_mod"
on public.courses for delete
to authenticated
using (public.is_moderator());

-- LECTURES POLICIES
drop policy if exists "lectures_select_auth" on public.lectures;
create policy "lectures_select_auth"
on public.lectures for select
to authenticated
using (true);

drop policy if exists "lectures_insert_mod" on public.lectures;
create policy "lectures_insert_mod"
on public.lectures for insert
to authenticated
with check (public.is_moderator());

drop policy if exists "lectures_update_mod" on public.lectures;
create policy "lectures_update_mod"
on public.lectures for update
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

drop policy if exists "lectures_delete_mod" on public.lectures;
create policy "lectures_delete_mod"
on public.lectures for delete
to authenticated
using (public.is_moderator());

-- RESOURCES POLICIES
drop policy if exists "resources_select_auth" on public.resources;
create policy "resources_select_auth"
on public.resources for select
to authenticated
using (true);

drop policy if exists "resources_insert_mod" on public.resources;
create policy "resources_insert_mod"
on public.resources for insert
to authenticated
with check (public.is_moderator() and uploader_id = auth.uid());

drop policy if exists "resources_update_mod" on public.resources;
create policy "resources_update_mod"
on public.resources for update
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

drop policy if exists "resources_delete_mod" on public.resources;
create policy "resources_delete_mod"
on public.resources for delete
to authenticated
using (public.is_moderator());

-- 9) Optional: auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_role text;
begin
  -- First user becomes admin (bootstrap). After that, everyone starts as student.
  if not exists (select 1 from public.profiles) then
    v_role := 'admin';
  else
    v_role := 'student';
  end if;

  insert into public.profiles (id, full_name, role)
  values (new.id, null, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 10) Seed examples (edit to match your subjects)
-- insert into public.courses (code, name, semester, description) values
-- ('PHARMA', 'Pharmacology', 2, 'Term 2 - 1st year Medicine');


-- ===== MCQ System (Question bank + Quizzes) =====

-- Migration: Add MCQ system (Question bank + Quizzes + Answers)
-- Safe to run on existing projects.

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
