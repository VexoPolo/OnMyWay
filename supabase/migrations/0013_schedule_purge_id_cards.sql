-- OnMyWay · 0013 · daily clean-up of ID photos past their keep time.
-- pg_cron (from 0011) calls the edge function purge-id-cards through pg_net at 03:00 UTC.
-- Needs two Vault secrets first (Dashboard -> Integrations -> Vault -> Add new secret):
--   omw_project_url = https://<project-ref>.supabase.co
--   omw_anon_key    = the project's public anon key (Project Settings -> API)
-- Nothing secret lives in this file. The function only deletes photos the database already
-- marked as due, so the public anon key is enough to call it.
create extension if not exists pg_net with schema extensions;

-- same job name replaces the job, so this is safe to re-run
select cron.schedule('omw-purge-id-cards', '0 3 * * *', $job$
  select net.http_post(
    url     := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'omw_project_url')
               || '/functions/v1/purge-id-cards',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'omw_anon_key')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000)
$job$);
