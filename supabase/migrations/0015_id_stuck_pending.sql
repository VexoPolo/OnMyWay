-- OnMyWay · 0015 · safety net: nobody stays at 'pending'.
-- If verify-id never finished (the runtime killed it, the app never called it, a network
-- failure), a student with a photo who has been pending for over an hour goes to review with
-- reason check_timeout, and the photo gets the usual 14-day delete time. Runs every 15 minutes.
-- Needs 0011 (pg_cron) and 0012.

create function private.id_release_stuck() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with stuck as (
    update public.profiles p
       set id_status = 'review', id_reason = 'check_timeout', id_checked_at = now(),
           id_photo_delete_after = now() + interval '14 days'
     where p.id_status = 'pending'
       and coalesce(p.id_uploaded_at, p.updated_at) < now() - interval '1 hour'
       and exists (select 1 from storage.objects o where o.bucket_id = 'id-cards' and o.name = p.id::text)
    returning p.id
  ), closed as (
    -- the attempt that never finished, if one was recorded
    update private.id_checks c set outcome = 'review', reason = 'check_timeout'
      from stuck where c.user_id = stuck.id and c.outcome is null
    returning 1
  )
  select count(*) into n from stuck;
  return n;
end $$;

revoke execute on function private.id_release_stuck() from public, anon, authenticated;

-- same job name replaces the job, so this is safe to re-run
select cron.schedule('omw-id-stuck-pending', '*/15 * * * *', 'select private.id_release_stuck()');
