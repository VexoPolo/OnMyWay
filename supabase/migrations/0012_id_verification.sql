-- OnMyWay · 0012 · automated ID-card checks.
-- The edge function supabase/functions/verify-id has Claude READ the card; plain code there
-- compares it with the profile and decides. These functions are its only way in.
-- Students can read their own id_status (profiles_read_own) but never write it: profiles has no
-- write grant and save_profile doesn't touch these columns. Only the service role can.
-- Needs 0010 (the id-cards bucket).

-- 1. status on the profile ------------------------------------------------------------------
-- none: no check yet · pending: photo uploaded, check due · approved / review / rejected: decided
alter table public.profiles
  add column id_status text not null default 'none'
    check (id_status in ('none', 'pending', 'approved', 'review', 'rejected')),
  add column id_reason             text check (id_reason is null or id_reason ~ '^[a-z_]{1,40}$'),
  add column id_uploaded_at        timestamptz,
  add column id_checked_at         timestamptz,
  add column id_photo_delete_after timestamptz;

-- 2. knobs (edit from the SQL editor) --------------------------------------------------------
insert into public.app_config (key, value, note) values
  ('id_checks_daily_cap', '200',
   'Automated ID checks in any 24 hours, all students together. Over the cap a check goes straight to review.'),
  ('id_allowed_institutions', '["Vellore Institute of Technology"]',
   'Institution names accepted on an ID card. Case, spaces and punctuation are ignored.'),
  ('require_approved_id_for_couriers', 'false',
   'true: accept_order returns ''unverified'' until the courier''s ID is approved.')
on conflict (key) do nothing;

-- 3. attempt log: who and when, never what was on the card ----------------------------------
create table private.id_checks (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  outcome    text check (outcome is null or outcome in ('approved', 'review', 'rejected')),
  reason     text
);
create index id_checks_user_idx on private.id_checks (user_id, created_at);
create index id_checks_time_idx on private.id_checks (created_at);
revoke all on private.id_checks from public, anon, authenticated;

-- 4. a new or replaced photo puts the student back to pending --------------------------------
-- Insert: a first upload. Update: only when the file itself was replaced (storage gives every
-- upload a new `version`), never for metadata or last-accessed changes.
create function private.id_card_uploaded() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    update public.profiles p
       set id_status = 'pending', id_reason = null, id_uploaded_at = now(), id_photo_delete_after = null
     where p.id = new.name::uuid;
  end if;
  return new;
end $$;

create trigger omw_id_card_uploaded
  after insert on storage.objects
  for each row when (new.bucket_id = 'id-cards')
  execute function private.id_card_uploaded();

create trigger omw_id_card_replaced
  after update of version on storage.objects
  for each row when (new.bucket_id = 'id-cards' and old.version is distinct from new.version)
  execute function private.id_card_uploaded();

-- 5. the edge functions' doors (service role only) -------------------------------------------
create function private.config_int(p_key text, p_default int) returns int
language sql stable set search_path = '' as $$
  select coalesce((select (c.value #>> '{}')::int from public.app_config c where c.key = p_key), p_default)
$$;

-- Step 1: may a check run? Records the attempt when it may. A student who registered before the
-- profile existed is still 'none' (the upload came first), so 'none' with a photo counts too:
-- verify-id only calls this once it has found the photo.
create function public.id_check_begin(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p     public.profiles;
  check_id bigint;
begin
  select * into p from public.profiles x where x.id = p_user for update;
  if not found then return jsonb_build_object('go', false, 'why', 'no_profile'); end if;
  if p.id_status not in ('none', 'pending') then
    return jsonb_build_object('go', false, 'why', 'decided', 'status', p.id_status);
  end if;
  if p.id_status = 'none' then
    update public.profiles x set id_status = 'pending', id_uploaded_at = now() where x.id = p_user
      returning * into p;
  end if;

  if (select count(*) from private.id_checks c where c.user_id = p_user and c.created_at > now() - interval '24 hours') >= 3
     or (select count(*) from private.id_checks c where c.user_id = p_user) >= 6 then
    return jsonb_build_object('go', false, 'why', 'too_many_attempts', 'uploaded_at', p.id_uploaded_at);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('omw-id-checks', 0)); -- one global count at a time
  if (select count(*) from private.id_checks c where c.created_at > now() - interval '24 hours')
     >= private.config_int('id_checks_daily_cap', 200) then
    return jsonb_build_object('go', false, 'why', 'daily_cap', 'uploaded_at', p.id_uploaded_at);
  end if;

  insert into private.id_checks (user_id) values (p_user) returning id into check_id;
  return jsonb_build_object(
    'go', true, 'check', check_id, 'uploaded_at', p.id_uploaded_at,
    'full_name', p.full_name, 'reg_no', p.reg_no,
    'institutions', coalesce((select c.value from public.app_config c where c.key = 'id_allowed_institutions'), '[]'::jsonb));
end $$;

-- Is this reg number already someone else's?
create function public.id_reg_used_by_other(p_user uuid, p_reg text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles x where x.reg_no = upper(p_reg) and x.id <> p_user)
$$;

-- Step 2: store the decision and when the photo goes.
-- approved, or rejected for any reason but reg_no_in_use: delete now. review, or reg_no_in_use:
-- keep up to 14 days for a person to look. Returns 'delete', 'keep', or 'stale' when a newer
-- upload arrived during the check (that upload gets its own check; nothing changes here).
create function public.id_check_finish(p_user uuid, p_check bigint, p_uploaded_at timestamptz,
                                       p_status text, p_reason text) returns text
language plpgsql security definer set search_path = '' as $$
declare keep boolean;
begin
  if p_status not in ('approved', 'review', 'rejected') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  keep := p_status = 'review' or (p_status = 'rejected' and p_reason = 'reg_no_in_use');
  update public.profiles x
     set id_status = p_status, id_reason = p_reason, id_checked_at = now(),
         id_photo_delete_after = case when keep then now() + interval '14 days' else now() end
   where x.id = p_user and x.id_status = 'pending' and x.id_uploaded_at is not distinct from p_uploaded_at;
  if not found then return 'stale'; end if;
  if p_check is not null then
    update private.id_checks c set outcome = p_status, reason = p_reason where c.id = p_check and c.user_id = p_user;
  end if;
  return case when keep then 'keep' else 'delete' end;
end $$;

-- Photos past their time, for purge-id-cards (and verify-id right after a decision).
create function public.id_photos_due(p_limit int default 100) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select x.id from public.profiles x
   where x.id_photo_delete_after <= now()
   order by x.id_photo_delete_after
   limit greatest(1, least(p_limit, 1000))
$$;

-- After the Storage API has removed them.
create function public.id_photos_deleted(p_users uuid[]) returns void
language sql security definer set search_path = '' as $$
  update public.profiles x set id_photo_delete_after = null
   where x.id = any(p_users) and x.id_photo_delete_after <= now()
$$;

revoke execute on function
  private.id_card_uploaded(),
  private.config_int(text, int),
  public.id_check_begin(uuid),
  public.id_reg_used_by_other(uuid, text),
  public.id_check_finish(uuid, bigint, timestamptz, text, text),
  public.id_photos_due(int),
  public.id_photos_deleted(uuid[])
from public, anon, authenticated;

grant execute on function
  public.id_check_begin(uuid),
  public.id_reg_used_by_other(uuid, text),
  public.id_check_finish(uuid, bigint, timestamptz, text, text),
  public.id_photos_due(int),
  public.id_photos_deleted(uuid[])
to service_role;

-- 6. couriers: optional approved-ID gate on accept -------------------------------------------
create function private.require_approved_id() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select (c.value #>> '{}')::boolean from public.app_config c
                    where c.key = 'require_approved_id_for_couriers'), false)
$$;
revoke execute on function private.require_approved_id() from public, anon, authenticated;

-- Same as 0003, plus 'unverified' when the gate is on and this courier isn't approved.
create or replace function public.accept_order(p_order uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.member();
  o   public.orders;
begin
  -- one courier's accepts run one at a time, so the batch cap can't be raced past
  perform pg_advisory_xact_lock(hashtextextended('omw-courier:' || uid::text, 0));
  select * into o from public.orders x where x.id = p_order;
  if not found then return 'missing'; end if;
  if o.customer_id = uid then return 'own'; end if;
  if private.require_approved_id()
     and not exists (select 1 from public.profiles p where p.id = uid and p.id_status = 'approved') then
    return 'unverified';
  end if;
  if (select count(*) from public.orders x
       where x.courier_id = uid and x.status in ('allocated', 'picked_up', 'on_the_way', 'reached', 'handed_over'))
     >= private.max_batch() then
    return 'limit';
  end if;

  update public.orders x
     set status = 'allocated', courier_id = uid, accepted_at = now()
   where x.id = p_order and x.status = 'available';
  if not found then return 'taken'; end if;
  perform private.log(p_order, uid, 'accepted', 'available', 'allocated');
  return 'ok';
end $$;
