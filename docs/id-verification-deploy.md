# ID verification: deploy from the Supabase dashboard

No CLI needed. Do the steps in order. Project: `fikinghjzmnxgmvnibyk`.

## 1. Database (SQL Editor)

Dashboard → **SQL Editor** → **New query**. For each file below: paste the whole file, click **Run**, check it says *Success*.

1. `supabase/migrations/0010_id_card_storage.sql` (the private `id-cards` bucket; safe to re-run)
2. `supabase/migrations/0011_schedule_release_stale.sql` (turns on pg_cron, schedules the 5-minute job)
3. `supabase/migrations/0012_id_verification.sql` (ID status, limits, the gate on accept)

Check: **Storage** shows a private bucket `id-cards`; **Integrations → Cron** shows `omw-release-stale`.
Files run here don't appear in the migration history list; that's expected.

## 2. The API key (you set it; it never goes in the repo or the app)

1. console.anthropic.com → **API keys** → create a key → copy it. Add a few dollars of credit under **Billing**.
2. Supabase → **Edge Functions** → **Secrets** → **Add new secret**
   - Name: `ANTHROPIC_API_KEY`
   - Value: the key
   - **Save**. Don't paste it anywhere else.

## 3. Function `verify-id`

1. **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name: `verify-id`. Replace the sample code with all of `supabase/functions/verify-id/index.ts`. **Deploy**.
3. Open the function → **Details** (or **Settings**) → **Verify JWT** must be **ON**. Save.

## 4. Function `purge-id-cards`

Same as step 3 with `supabase/functions/purge-id-cards/index.ts`, name `purge-id-cards`, **Verify JWT ON**.

## 5. Daily photo clean-up

**Integrations → Cron → Create job**
- Name: `omw-purge-id-cards` · Schedule: `0 3 * * *` (03:00 UTC daily)
- Type: **Supabase Edge Function** → `purge-id-cards`, method **POST**
- If the form doesn't add an Authorization header itself, add `Authorization: Bearer <anon key>`
  (Project Settings → API; the public anon key, not the service key). The function only deletes
  photos already due, so the public key is enough.
- If it asks to enable `pg_net`, allow it.

## 6. Try it

1. In the app, register (or sign in and add an ID card) with a clear photo of a real card.
2. **Table Editor → profiles**: that row's `id_status` goes `pending` → `approved` / `review` / `rejected`, with `id_reason`.
3. **Edge Functions → verify-id → Logs**: one line like `verify-id approved -`. No names or numbers appear.
4. **Storage → id-cards**: after `approved` the photo is gone.

## Knobs (SQL Editor)

```sql
update public.app_config set value = '300' where key = 'id_checks_daily_cap';
update public.app_config set value = '["Vellore Institute of Technology"]' where key = 'id_allowed_institutions';
update public.app_config set value = 'true' where key = 'require_approved_id_for_couriers';  -- couriers need an approved ID
```

A person reviewing a card: open it in **Storage → id-cards**, then set the result, for example
`update public.profiles set id_status = 'approved', id_reason = null, id_photo_delete_after = now() where reg_no = '…';`
(`id_photo_delete_after = now()` lets the next clean-up delete the photo.)
