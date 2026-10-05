-- OnMyWay · 0011 · return stale accepted orders to the pool every 5 minutes.
create extension if not exists pg_cron with schema pg_catalog;
-- the line from 0003; a job with the same name is replaced, so this is safe to re-run
select cron.schedule('omw-release-stale', '*/5 * * * *', 'select public.release_stale_orders()');
