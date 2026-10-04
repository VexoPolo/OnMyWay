-- OnMyWay · 0010 · the student ID card photo from Registration.
-- One private bucket, one file per student, named by their auth id (no folder, no extension).
-- Only that student can upload, read and replace it. No policy grants anyone else access —
-- not couriers, not other students. Admins check it from the dashboard (service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('id-cards', 'id-cards', false, 5242880, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "id card: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'id-cards' and name = (select auth.uid())::text);

create policy "id card: owner reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'id-cards' and name = (select auth.uid())::text);

create policy "id card: owner replaces" on storage.objects
  for update to authenticated
  using (bucket_id = 'id-cards' and name = (select auth.uid())::text)
  with check (bucket_id = 'id-cards' and name = (select auth.uid())::text);
