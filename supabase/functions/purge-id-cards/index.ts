// OnMyWay · purge-id-cards · deletes ID-card photos whose keep time is over (see 0012).
// Run once a day from Integrations -> Cron. Safe for anyone to trigger: it only removes photos
// the database already marked as due, and only through the Storage API. Logs counts only.
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async () => {
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await service.rpc('id_photos_due', { p_limit: 500 });
  if (error) {
    console.error('purge-id-cards due', error.code);
    return json({ error: 'unavailable' }, 503);
  }
  const ids = (data ?? []) as string[];
  if (ids.length) {
    const { error: rm } = await service.storage.from('id-cards').remove(ids);
    if (rm) {
      console.error('purge-id-cards remove', rm.name);
      return json({ error: 'remove_failed' }, 500);
    }
    await service.rpc('id_photos_deleted', { p_users: ids });
  }
  console.log('purge-id-cards deleted', ids.length);
  return json({ deleted: ids.length });
});
