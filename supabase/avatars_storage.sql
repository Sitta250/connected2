-- ============================================================
-- Avatar Storage + Profile Bio
-- Run in Supabase SQL editor
-- ============================================================

-- Add bio column to profiles (if not already present)
alter table profiles add column if not exists bio text;

-- ─── Storage policies for the "avatars" bucket ───────────────────────────────
-- Create the bucket first in Supabase Dashboard → Storage → New bucket
-- Name: avatars, Public: true

create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
