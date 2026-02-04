-- =========
-- Migration: Add Lectures (محاضرات) layer
-- Run this ONCE in Supabase SQL Editor if you already have an existing project/data.
-- Safe to run multiple times (idempotent-ish).
-- =========

create extension if not exists "pgcrypto";

-- 1) Create lectures table
create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists lectures_course_idx on public.lectures(course_id);
create unique index if not exists lectures_course_order_unique on public.lectures(course_id, order_index);

-- 2) Add lecture_id to resources (if missing)
alter table public.resources
  add column if not exists lecture_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resources_lecture_fk'
  ) then
    alter table public.resources
      add constraint resources_lecture_fk
      foreign key (lecture_id) references public.lectures(id) on delete set null;
  end if;
end$$;

create index if not exists resources_lecture_idx on public.resources(lecture_id);

-- 3) RLS for lectures
alter table public.lectures enable row level security;

-- Helper function exists? (older schema already has it)
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

-- 4) Backfill: move existing resources into a default lecture per course
-- Creates a lecture titled "عام (قبل التقسيم)" with order_index=0 if needed.

insert into public.lectures (course_id, title, order_index)
select c.id, 'عام (قبل التقسيم)', 0
from public.courses c
where exists (
  select 1 from public.resources r
  where r.course_id = c.id and r.lecture_id is null
)
and not exists (
  select 1 from public.lectures l
  where l.course_id = c.id and l.order_index = 0
);

update public.resources r
set lecture_id = l.id
from public.lectures l
where r.course_id = l.course_id
  and l.order_index = 0
  and r.lecture_id is null;
