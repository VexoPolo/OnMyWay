-- OnMyWay · 0003 · functions.
-- Every state change goes through one of these. None of them takes a user id or reg number:
-- the caller is always auth.uid(), checked by private.me() / private.member() on every call.
-- Errors are raised with a short machine-readable message (e.g. 'profile_required') that the
-- app maps to copy; the hint carries a human sentence for logs.

-- 1. constants -------------------------------------------------------------------------------
create function private.max_batch()        returns int      language sql immutable as $$ select 4 $$;
create function private.max_open_orders()  returns int      language sql immutable as $$ select 5 $$;
create function private.pin_ttl()          returns interval language sql immutable as $$ select interval '5 minutes' $$;
create function private.pin_max_attempts() returns int      language sql immutable as $$ select 5 $$;
create function private.stale_after()      returns interval language sql immutable as $$ select interval '30 minutes' $$;

-- Priced by parcel class only: Regular (S/M) Rs 20, Large (L/XL) Rs 30.
create function private.fare_for(p_size text) returns int
language sql immutable set search_path = '' as $$
  select case upper(p_size) when 'S' then 20 when 'M' then 20 when 'L' then 30 when 'XL' then 30 end
$$;

create function private.platform_of(p_tracking text) returns text
language sql immutable set search_path = '' as $$
  select case when p_tracking like 'TBA%' then 'Amazon'
              when p_tracking like 'FLP%' then 'Flipkart'
              when p_tracking like 'MYN%' then 'Myntra'
              else 'Courier' end
$$;

create function private.digits(p text) returns text
language sql immutable set search_path = '' as $$ select nullif(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), '') $$;

-- n random decimal digits from the server's strong RNG (gen_random_uuid -> pg_strong_random)
create function private.random_digits(n int) returns text
language sql volatile set search_path = '' as $$
  select lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint)
               % (10 ^ n)::bigint)::text, n, '0')
$$;

-- 2. who is calling ---------------------------------------------------------------------------
-- Signed in, and their email is (still) on the allowed list.
create function private.me() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  em  text;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '28000', hint = 'Sign in first.';
  end if;
  select u.email into em from auth.users u where u.id = uid;
  if not private.email_allowed(em) then
    raise exception 'email_not_allowed' using errcode = '42501', hint = 'This email domain is not allowed on OnMyWay.';
  end if;
  return uid;
end $$;

-- me() + a completed profile. Everything order-related needs this.
create function private.member() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.me();
begin
  if not exists (select 1 from public.profiles p where p.id = uid) then
    raise exception 'profile_required' using errcode = 'P0001', hint = 'Finish your profile first.';
  end if;
  return uid;
end $$;

-- Boolean form for RLS policies (never raises).
create function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
     where p.id = auth.uid() and private.email_allowed(u.email))
$$;

create function private.log(p_order uuid, p_actor uuid, p_event text, p_from text, p_to text,
                            p_detail jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.order_events (order_id, actor_id, event, from_status, to_status, detail)
  values (p_order, p_actor, p_event, p_from, p_to, coalesce(p_detail, '{}'::jsonb))
$$;

-- 3. profile ----------------------------------------------------------------------------------
-- Create or update my profile. The reg number locks after the first save.
create function public.save_profile(p_reg_no text, p_full_name text, p_phone text, p_hostel_block text,
                                    p_upi text default null)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.me();
  reg text := upper(trim(coalesce(p_reg_no, '')));
  r   public.profiles;
begin
  insert into public.profiles as p (id, reg_no, full_name, phone, hostel_block, upi_vpa)
  values (uid, reg, trim(p_full_name), right(private.digits(p_phone), 10), trim(p_hostel_block),
          nullif(trim(coalesce(p_upi, '')), ''))
  on conflict (id) do update
     set full_name = excluded.full_name, phone = excluded.phone,
         hostel_block = excluded.hostel_block, upi_vpa = excluded.upi_vpa
  returning * into r;
  if r.reg_no <> reg then
    raise exception 'reg_no_locked' using errcode = 'P0001', hint = 'Your registration number cannot be changed.';
  end if;
  return r;
exception
  when unique_violation then
    raise exception 'reg_no_taken' using errcode = 'P0001', hint = 'That registration number is already registered.';
  when check_violation then
    raise exception 'invalid_profile' using errcode = 'P0001', hint = sqlerrm;
end $$;

-- 4. fares ------------------------------------------------------------------------------------
create function public.quote_fare(p_size text) returns int
language plpgsql stable security definer set search_path = '' as $$
declare f int;
begin
  perform private.me();
  f := private.fare_for(p_size);
  if f is null then raise exception 'invalid_size' using errcode = 'P0001'; end if;
  return f;
end $$;

-- 5. orders -----------------------------------------------------------------------------------
-- Customer places an order. The server sets the id, fare and platform.
create function public.place_order(p_pickup_point text, p_tracking_id text, p_size text, p_drop_block text,
                                   p_note text default '', p_pickup_otp text default null,
                                   p_driver_phone text default null)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  uid   uuid := private.member();
  tid   text := nullif(upper(regexp_replace(coalesce(p_tracking_id, ''), '\s', '', 'g')), '');
  blk   text;
  fare  int  := private.fare_for(p_size);
  o     public.orders;
begin
  if fare is null then raise exception 'invalid_size' using errcode = 'P0001'; end if;
  if (select count(*) from public.orders x
       where x.customer_id = uid
         and x.status in ('available', 'allocated', 'picked_up', 'on_the_way', 'reached', 'handed_over'))
     >= private.max_open_orders() then
    raise exception 'too_many_open_orders' using errcode = 'P0001',
      hint = format('You can have at most %s open orders.', private.max_open_orders());
  end if;
  if p_pickup_point = 'Amazon Pick Up Point' and tid is null then
    raise exception 'tracking_required' using errcode = 'P0001';
  end if;
  tid := coalesce(tid, 'OMW-' || private.random_digits(6));   -- gate pickups without a platform id
  blk := coalesce(nullif(trim(coalesce(p_drop_block, '')), ''),
                  (select p.hostel_block from public.profiles p where p.id = uid));

  insert into public.orders (customer_id, pickup_point, tracking_id, platform, size, drop_block, note, fare)
  values (uid, p_pickup_point, tid, private.platform_of(tid), upper(p_size), blk, trim(coalesce(p_note, '')), fare)
  returning * into o;
  insert into public.order_secrets (order_id, pickup_otp, driver_phone)
  values (o.id, private.digits(p_pickup_otp), private.digits(p_driver_phone));
  perform private.log(o.id, uid, 'placed', null, 'available', jsonb_build_object('fare', fare, 'size', o.size));
  return o;
exception
  when check_violation then
    raise exception 'invalid_order' using errcode = 'P0001', hint = sqlerrm;
end $$;

-- Courier takes an open order. First tap wins: one conditional UPDATE.
-- Returns 'ok' | 'taken' | 'missing' | 'limit' | 'own'.
create function public.accept_order(p_order uuid) returns text
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

-- Courier: allocated -> picked_up -> on_the_way. Returns false if not your order / wrong step.
create function public.advance_order(p_order uuid, p_to text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := private.member();
  prev text;
begin
  prev := case p_to when 'picked_up' then 'allocated' when 'on_the_way' then 'picked_up' end;
  if prev is null then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  update public.orders x
     set status        = p_to,
         picked_up_at  = case when p_to = 'picked_up'  then now() else x.picked_up_at  end,
         on_the_way_at = case when p_to = 'on_the_way' then now() else x.on_the_way_at end
   where x.id = p_order and x.courier_id = uid and x.status = prev;
  if not found then return false; end if;
  perform private.log(p_order, uid, p_to, prev, p_to);
  return true;
end $$;

-- Courier is at the door. The SERVER makes the PIN; the courier never sees it.
create function public.arrive_order(p_order uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.member();
  exp timestamptz := now() + private.pin_ttl();
begin
  update public.orders x
     set status = 'reached', arrived_at = now(), pin_expiry = exp
   where x.id = p_order and x.courier_id = uid and x.status = 'on_the_way';
  if not found then return false; end if;
  update public.order_secrets s
     set delivery_pin = private.random_digits(4), pin_expiry = exp, pin_attempts = 0
   where s.order_id = p_order;
  perform private.log(p_order, uid, 'arrived', 'on_the_way', 'reached');
  return true;
end $$;

-- Customer asks for a fresh code (also clears a lock-out).
create function public.refresh_pin(p_order uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.member();
  exp timestamptz := now() + private.pin_ttl();
begin
  update public.orders x set pin_expiry = exp
   where x.id = p_order and x.customer_id = uid and x.status = 'reached';
  if not found then return false; end if;
  update public.order_secrets s
     set delivery_pin = private.random_digits(4), pin_expiry = exp, pin_attempts = 0
   where s.order_id = p_order;
  perform private.log(p_order, uid, 'pin_refreshed', 'reached', 'reached');
  return true;
end $$;

-- Courier types the customer's code. Compared inside the database, attempts capped.
-- Returns 'ok' | 'wrong' | 'expired' | 'locked'.
create function public.verify_handover(p_order uuid, p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.member();
  s   public.order_secrets;
begin
  perform 1 from public.orders x
   where x.id = p_order and x.courier_id = uid and x.status = 'reached'
     for update;
  if not found then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  select * into s from public.order_secrets y where y.order_id = p_order for update;

  if s.pin_attempts >= private.pin_max_attempts() then return 'locked'; end if;
  if s.pin_expiry is null or now() > s.pin_expiry then return 'expired'; end if;
  if s.delivery_pin is distinct from trim(coalesce(p_code, '')) then
    update public.order_secrets y set pin_attempts = y.pin_attempts + 1 where y.order_id = p_order;
    perform private.log(p_order, uid, 'pin_wrong', 'reached', 'reached',
                        jsonb_build_object('attempt', s.pin_attempts + 1));
    if s.pin_attempts + 1 >= private.pin_max_attempts() then
      perform private.log(p_order, uid, 'pin_locked', 'reached', 'reached');
      return 'locked';
    end if;
    return 'wrong';
  end if;

  update public.orders x set status = 'handed_over', handed_over_at = now() where x.id = p_order;
  update public.order_secrets y set delivery_pin = null where y.order_id = p_order;
  perform private.log(p_order, uid, 'handed_over', 'reached', 'handed_over');
  return 'ok';
end $$;

-- Courier: slide-to-complete after the handover.
create function public.complete_order(p_order uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.member();
begin
  update public.orders x set status = 'delivered', delivered_at = now()
   where x.id = p_order and x.courier_id = uid and x.status = 'handed_over';
  if not found then return false; end if;
  perform private.log(p_order, uid, 'delivered', 'handed_over', 'delivered');
  return true;
end $$;

-- Customer: only before pickup.
create function public.cancel_order(p_order uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := private.member();
  prev text;
begin
  select x.status into prev from public.orders x
   where x.id = p_order and x.customer_id = uid and x.status in ('available', 'allocated')
     for update;
  if not found then return false; end if;
  update public.orders x set status = 'cancelled', cancelled_at = now() where x.id = p_order;
  perform private.log(p_order, uid, 'cancelled', prev, 'cancelled');
  return true;
end $$;

-- Customer: 1-5 stars, once, after delivery.
create function public.rate_order(p_order uuid, p_stars int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.member();
begin
  if p_stars is null or p_stars not between 1 and 5 then return false; end if;
  update public.orders x set rating = p_stars
   where x.id = p_order and x.customer_id = uid and x.status = 'delivered' and x.rating is null;
  if not found then return false; end if;
  perform private.log(p_order, uid, 'rated', 'delivered', 'delivered', jsonb_build_object('stars', p_stars));
  return true;
end $$;

-- Customer adds the platform driver's number while the order is live.
create function public.set_driver_phone(p_order uuid, p_phone text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.member();
  st  text;
begin
  select x.status into st from public.orders x
   where x.id = p_order and x.customer_id = uid
     and x.status in ('available', 'allocated', 'picked_up', 'on_the_way');
  if not found then return false; end if;
  update public.order_secrets s set driver_phone = private.digits(p_phone) where s.order_id = p_order;
  update public.orders x set updated_at = now() where x.id = p_order;   -- nudges realtime so the courier refetches
  perform private.log(p_order, uid, 'driver_phone_set', st, st);       -- the number itself stays out of the log
  return true;
exception
  when check_violation then return false;
end $$;

-- Report a problem. The role comes from who you are on the order.
-- Customer -> order DISPUTED.  Courier -> order goes back to the open pool, PIN cleared.
create function public.report_order(p_order uuid, p_reason text, p_note text default '') returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := private.member();
  o    public.orders;
  role text;
begin
  select * into o from public.orders x where x.id = p_order for update;
  if not found then return false; end if;
  role := case when o.customer_id = uid then 'customer' when o.courier_id = uid then 'courier' end;
  if role is null then return false; end if;

  if role = 'customer' then
    if o.status in ('delivered', 'cancelled', 'disputed') then return false; end if;
    update public.orders x set status = 'disputed' where x.id = p_order;
    perform private.log(p_order, uid, 'disputed', o.status, 'disputed', jsonb_build_object('reason', p_reason));
  else
    if o.status not in ('allocated', 'picked_up', 'on_the_way', 'reached') then return false; end if;
    update public.orders x
       set status = 'available', courier_id = null, accepted_at = null, picked_up_at = null,
           on_the_way_at = null, arrived_at = null, pin_expiry = null
     where x.id = p_order;
    update public.order_secrets s set delivery_pin = null, pin_expiry = null, pin_attempts = 0 where s.order_id = p_order;
    perform private.log(p_order, uid, 'released', o.status, 'available', jsonb_build_object('reason', p_reason));
  end if;

  insert into public.reports (order_id, reporter_id, reporter_role, reason, note)
  values (p_order, uid, role, left(trim(coalesce(p_reason, '')), 80), left(trim(coalesce(p_note, '')), 500));
  return true;
end $$;

-- What only the two people on an order may see.
--   customer: the PIN (while the courier is at the door) + the courier's name, reg no, phone, UPI
--   courier:  pickup code, driver phone, the customer's name, reg no and phone; never the PIN
--   anyone else: zero rows
create function public.get_order_private(p_order uuid)
returns table (my_role text, delivery_pin text, pin_expiry timestamptz, pin_attempts_left int,
               pickup_otp text, driver_phone text,
               other_name text, other_reg_no text, other_phone text, other_upi text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := private.member();
  o   public.orders;
begin
  select * into o from public.orders x where x.id = p_order;
  if not found then return; end if;

  if o.customer_id = uid then
    return query
      select 'customer'::text,
             case when o.status = 'reached' then s.delivery_pin end,
             s.pin_expiry,
             greatest(private.pin_max_attempts() - s.pin_attempts, 0),
             s.pickup_otp, s.driver_phone,
             c.full_name, c.reg_no, c.phone, c.upi_vpa
        from public.order_secrets s
        left join public.profiles c on c.id = o.courier_id
       where s.order_id = p_order;
  elsif o.courier_id = uid and o.status in ('allocated', 'picked_up', 'on_the_way', 'reached', 'handed_over') then
    return query
      select 'courier'::text,
             null::text,
             s.pin_expiry,
             greatest(private.pin_max_attempts() - s.pin_attempts, 0),
             s.pickup_otp, s.driver_phone,
             c.full_name, c.reg_no, c.phone, null::text
        from public.order_secrets s
        join public.profiles c on c.id = o.customer_id
       where s.order_id = p_order;
  end if;
end $$;

-- 6. housekeeping (scheduled job only, no client may call it) ---------------------------------
-- A courier who accepted and went silent for 30 minutes loses the order.
create function public.release_stale_orders() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    update public.orders x
       set status = 'available', courier_id = null, accepted_at = null
     where x.status = 'allocated' and x.accepted_at < now() - private.stale_after()
    returning x.id
  loop
    perform private.log(r.id, null, 'released_stale', 'allocated', 'available');
    n := n + 1;
  end loop;
  return n;
end $$;
-- To schedule (Dashboard -> Integrations -> Cron, or with pg_cron enabled):
--   select cron.schedule('omw-release-stale', '*/5 * * * *', 'select public.release_stale_orders()');
