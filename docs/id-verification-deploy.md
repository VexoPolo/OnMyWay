# ID verification: deploy from the Supabase dashboard

No CLI, no API key. The check reads the barcode on the student's ID card and compares it with the
reg number they typed. Do the steps in order. Project: `fikinghjzmnxgmvnibyk`.

## 1. Database (SQL Editor)

Dashboard → **SQL Editor** → **New query**. For each file: paste the whole file, **Run**, check *Success*.

1. `supabase/migrations/0010_id_card_storage.sql` (private `id-cards` bucket; safe to re-run)
2. `supabase/migrations/0011_schedule_release_stale.sql` (pg_cron + the 5-minute job)
3. `supabase/migrations/0012_id_verification.sql` (ID status, limits, gate on accept)
4. `supabase/migrations/0014_id_barcode_review.sql` (auto-approve switch, reviewer decision)
5. `supabase/migrations/0015_id_stuck_pending.sql` (every 15 min: pending over an hour -> review, `check_timeout`)

Check: **Storage** shows a private bucket `id-cards`; **Integrations → Cron** shows `omw-release-stale` and `omw-id-stuck-pending`.
Files run here don't appear in the migration history list; that's expected.

## 2. Function `verify-id`

1. **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name: `verify-id`. Replace the sample code with all of `supabase/functions/verify-id/index.ts`.
3. In the editor, add a second file named exactly `zxing_reader_wasm.ts` and paste all of
   `supabase/functions/verify-id/zxing_reader_wasm.ts` into it (one long line, about 1.3 MB: the
   barcode reader). **Deploy**. If the editor won't take a file that size, stop and say so.
4. Open the function → **Details** → **Verify JWT** must be **ON**. Save.

No secrets to add, and nothing is fetched at runtime: the barcode reader is inside the function and
its SHA-256 is checked before use. The photo never leaves the project.

## 3. Function `purge-id-cards`

Same as step 2 with `supabase/functions/purge-id-cards/index.ts`, name `purge-id-cards`, **Verify JWT ON**.

## 4. Daily photo clean-up (pg_cron + pg_net)

1. **Integrations → Vault → Add new secret**, twice (these stay out of the repo):
   - `omw_project_url` = `https://fikinghjzmnxgmvnibyk.supabase.co`
   - `omw_anon_key` = the public anon key (Project Settings → API; not the service key)
2. **SQL Editor**: paste and run `supabase/migrations/0013_schedule_purge_id_cards.sql`.
3. **Integrations → Cron** shows `omw-purge-id-cards` at `0 3 * * *`.

If the project's keys are the new `sb_publishable_…` kind (not a JWT), **Verify JWT** can't accept
them: say so before step 2 and the call will be switched to the service key from Vault.

## 5. Test with your own card only (no digits typed or pasted anywhere)

Leave `id_auto_approve_on_barcode` as `false` for the test.

1. In the app, sign in as yourself and add a clear photo of your ID card, barcode flat and in focus.
2. **Table Editor → profiles** → your row (find it by your name). Read `id_status` and `id_reason`:
   - `review` + `barcode_match`: the barcode matched the reg number you typed. It works.
   - `review` + `barcode_unreadable`: the reader found no reg number; retake the photo closer, in good light.
   - `rejected` + `reg_mismatch`: the barcode holds a different reg number than your profile.
3. **Edge Functions → verify-id → Logs**: one line such as `verify-id review barcode_match`. No numbers appear.
4. Replace the photo once in the app: `id_status` goes back to `pending`, then to the new result.
5. Finish your own review: run `supabase/scripts/id_review_queue.sql`, copy **your user_id** (not your
   reg number) from the result, and run
   `select public.id_review_decide('<your user_id>', 'approved', 'reviewer_approved');`
   The next purge removes the photo.

## Reviewing

- Queue: run `supabase/scripts/id_review_queue.sql` (read-only, oldest first).
- Look at the photo in **Storage → id-cards** (file named by the user id).
- Decide: `select public.id_review_decide('<user_id>', 'approved' | 'rejected', '<reason>');`
  Reasons are lowercase letters and underscores, e.g. `reviewer_approved`, `reviewer_rejected`.

## Knobs (SQL Editor)

```sql
update public.app_config set value = 'true' where key = 'id_auto_approve_on_barcode';      -- barcode match approves at once
update public.app_config set value = '300'  where key = 'id_checks_daily_cap';
update public.app_config set value = 'true' where key = 'require_approved_id_for_couriers'; -- couriers need an approved ID
```
