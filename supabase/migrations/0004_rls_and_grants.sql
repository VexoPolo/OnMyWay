-- OnMyWay · 0004 · RLS on every table, no direct writes, functions are the only door.

-- 1. RLS on everything ------------------------------------------------------------------------
alter table public.app_config    enable row level security;
alter table public.profiles      enable row level security;
alter table public.orders        enable row level security;
alter table public.order_secrets enable row level security;
alter table public.order_events  enable row level security;
alter table public.reports       enable row level security;

-- 2. table privileges: anon gets nothing; signed-in users may only SELECT, and only where a
--    policy below lets them. app_config and order_secrets get no access at all.
revoke all on public.app_config, public.profiles, public.orders, public.order_secrets,
              public.order_events, public.reports
  from public, anon, authenticated;
grant select on public.profiles, public.orders, public.order_events, public.reports to authenticated;

-- 3. read policies ----------------------------------------------------------------------------
create policy profiles_read_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- Your orders as customer, your jobs as courier, and the open pool (signed-in members only).
-- The open pool carries no names or phones; those come from get_order_private().
create policy orders_read on public.orders
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or courier_id = (select auth.uid())
    or (status = 'available' and (select private.is_member()))
  );

-- History of an order, for the two people on it.
create policy order_events_read on public.order_events
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = order_id
       and (o.customer_id = (select auth.uid()) or o.courier_id = (select auth.uid()))));

create policy reports_read_own on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));

-- 4. functions ------------------------------------------------------------------------------
-- Supabase grants EXECUTE on new functions to anon and authenticated by default: take it all
-- back, then hand out exactly what the app needs.
revoke execute on all functions in schema public  from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.save_profile(text, text, text, text, text),
  public.quote_fare(text),
  public.place_order(text, text, text, text, text, text, text),
  public.accept_order(uuid),
  public.advance_order(uuid, text),
  public.arrive_order(uuid),
  public.refresh_pin(uuid),
  public.verify_handover(uuid, text),
  public.complete_order(uuid),
  public.cancel_order(uuid),
  public.rate_order(uuid, int),
  public.set_driver_phone(uuid, text),
  public.report_order(uuid, text, text),
  public.get_order_private(uuid)
to authenticated;

-- The orders_read policy calls this one helper as the signed-in user.
grant usage on schema private to authenticated;
grant execute on function private.is_member() to authenticated;

-- Keep future objects locked down by default too.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;
