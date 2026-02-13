-- =========
-- Migration: Add is_archived flag to MCQ questions (soft-delete / hide)
-- Run this once in Supabase SQL Editor.
-- =========

alter table public.mcq_questions
add column if not exists is_archived boolean not null default false;

create index if not exists mcq_questions_archived_idx
on public.mcq_questions(is_archived);

-- Update select policy: students see only non-archived; moderators see all
drop policy if exists "mcq_questions_select_auth" on public.mcq_questions;
create policy "mcq_questions_select_auth"
on public.mcq_questions for select
to authenticated
using (public.is_moderator() or is_archived = false);
