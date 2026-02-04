-- =========
-- Supabase Storage policies for bucket: resources (private)
-- =========

-- Create bucket in Dashboard:
-- Storage -> New bucket -> name: resources -> Private

-- Enable RLS for storage.objects is already enabled by default in Supabase.
-- These policies allow:
-- - Authenticated users to read/download any object in the bucket (via signed URLs).
-- - Moderators/Admins to upload/delete objects in the bucket.

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

-- READ: authenticated can SELECT objects in resources bucket
drop policy if exists "storage_read_auth_resources" on storage.objects;
create policy "storage_read_auth_resources"
on storage.objects for select
to authenticated
using (bucket_id = 'resources');

-- INSERT: moderators can upload
drop policy if exists "storage_insert_mod_resources" on storage.objects;
create policy "storage_insert_mod_resources"
on storage.objects for insert
to authenticated
with check (bucket_id = 'resources' and public.is_moderator());

-- UPDATE: moderators can update metadata/path if needed (optional)
drop policy if exists "storage_update_mod_resources" on storage.objects;
create policy "storage_update_mod_resources"
on storage.objects for update
to authenticated
using (bucket_id = 'resources' and public.is_moderator())
with check (bucket_id = 'resources' and public.is_moderator());

-- DELETE: moderators can delete
drop policy if exists "storage_delete_mod_resources" on storage.objects;
create policy "storage_delete_mod_resources"
on storage.objects for delete
to authenticated
using (bucket_id = 'resources' and public.is_moderator());
