-- OnMyWay · cleanup · delete ONLY the test accounts listed below, and everything that points at them.
-- Paste into the Supabase SQL Editor. Not a migration — run by hand, never automatically.
--
-- HOW TO RUN
--   1. Put the test emails in the array in STEP 1.
--   2. Highlight STEP 1 + STEP 2 and press Run (runs only the selection). Read the preview.
--   3. Happy? Press Run on the whole script. It deletes inside one transaction.
--   4. Delete the ID photos by hand in Storage -> id-cards (paths are in the preview).
--      Storage files can't be deleted from SQL.
--
-- DELETE ORDER (each step removes what points at the next):
--   reports -> order_events -> order_secrets -> orders -> profiles -> auth.users
--   orders, reports and order_events reference profiles; profiles references auth.users.
--   order_events is append-only (trigger omw_events_append_only), so that trigger is switched off
--   for this transaction only, and switched back on before commit.
--
-- WHICH ORDERS: every order where a test account is the customer OR the courier. If a real student
-- was on the other side, the preview flags it ("real student on it") — remove that email or stop.

-- ============ STEP 1 · THE TEST ACCOUNTS (edit this list) ============
drop table if exists pg_temp.cleanup_targets;
create temp table cleanup_targets as
select u.id, u.email
from auth.users u
where lower(u.email) = any (array[
  'test1@vitstudent.ac.in',
  'test2@vitstudent.ac.in'
]::text[]);

-- ============ STEP 2 · PREVIEW (read-only) ============
with t as (select id from cleanup_targets),
o as (
  select o.* from public.orders o
  where o.customer_id in (select id from t) or o.courier_id in (select id from t)
)
select 'auth user' as kind, u.id::text as id, u.email as detail, u.created_at::text as note
  from auth.users u where u.id in (select id from t)
union all
select 'profile', p.id::text, p.reg_no || ' · ' || p.full_name, p.created_at::text
  from public.profiles p where p.id in (select id from t)
union all
select 'order', o.id::text, o.tracking_id || ' · ' || o.status,
       case when o.customer_id not in (select id from t)
              or (o.courier_id is not null and o.courier_id not in (select id from t))
            then 'real student on it' else 'test only' end
  from o
union all
select 'order_secrets', s.order_id::text, '', '' from public.order_secrets s where s.order_id in (select id from o)
union all
select 'order_events', count(*)::text, 'on these orders (deleted)', '' from public.order_events e where e.order_id in (select id from o)
union all
select 'order_events', count(*)::text, 'by test accounts on other orders (actor set to null)', ''
  from public.order_events e where e.actor_id in (select id from t) and e.order_id not in (select id from o)
union all
select 'reports', r.id::text, r.reason, r.order_id::text
  from public.reports r where r.reporter_id in (select id from t) or r.order_id in (select id from o)
union all
select 'id photo (delete in Storage)', 'id-cards/' || t.id::text, '', '' from t
order by 1;

-- ============ STEP 3 · DELETE (one transaction) ============
begin;

create temp table cleanup_orders on commit drop as
select o.id from public.orders o
where o.customer_id in (select id from cleanup_targets) or o.courier_id in (select id from cleanup_targets);

delete from public.reports
 where reporter_id in (select id from cleanup_targets) or order_id in (select id from cleanup_orders);

alter table public.order_events disable trigger omw_events_append_only;
delete from public.order_events where order_id in (select id from cleanup_orders);
update public.order_events set actor_id = null where actor_id in (select id from cleanup_targets);
alter table public.order_events enable trigger omw_events_append_only;

delete from public.order_secrets where order_id in (select id from cleanup_orders);
delete from public.orders        where id       in (select id from cleanup_orders);
delete from public.profiles      where id       in (select id from cleanup_targets);
delete from auth.users           where id       in (select id from cleanup_targets);  -- also clears their sessions/identities

commit;
drop table if exists pg_temp.cleanup_targets;
