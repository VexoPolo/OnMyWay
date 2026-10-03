-- OnMyWay · 0005 · live updates.
-- Realtime respects RLS: each phone only receives changes to rows it is allowed to SELECT
-- (its own orders, its own jobs, and the open pool).
alter publication supabase_realtime add table public.orders;
