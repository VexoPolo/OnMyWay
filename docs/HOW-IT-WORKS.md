# How the OnMyWay backend works

A guide for anyone learning backend programming from this project. There's no server code of
our own: the backend is a Postgres database hosted by Supabase. The app talks to it directly,
and the database decides who's allowed to do what.

Three ideas to keep in mind:

1. **Reading is open, writing is a function call.** The app can `select` from tables, but
   only the rows it's allowed to see (Row Level Security, "RLS"). It can never `insert` or
   `update` a table directly. Every change goes through a database function (an "RPC").
2. **The database knows who you are.** No function takes a user id. Each one calls
   `auth.uid()` to find out who signed in, so a modified app can't pretend to be someone else.
3. **Realtime follows RLS.** When an `orders` row changes, Supabase pushes the new row to
   every phone that is allowed to read it, and to no other phone.

## 1. File map

**`app/src/services/backend/`**: the only place the app touches Supabase.

| File | What it does |
|---|---|
| `client.ts` | Creates the one Supabase client (`db`), keeps the session on the device, refreshes tokens while the app is open. |
| `config.ts` | Picks the sign-in method (email code, Google, Microsoft) and the code length from `.env`. |
| `auth.ts` | Sign-in and sign-out: `sendEmailCode`, `verifyEmailCode`, `startOAuth`, `finishOAuth`, `getSession`, `onAuthChange`, `signOut`. |
| `api.ts` | Everything else the app asks for. Reads tables (`listOrders`, `getOrder`, …), calls database functions (`acceptOrder` → `accept_order`, …), subscribes to live changes (`subscribeOrders`). Also converts database rows (`snake_case`, status words like `allocated`) into app objects (`camelCase`, states like `AGENT_ASSIGNED`). |
| `errors.ts` | Turns every failure into an `ApiError` with a short `code` (e.g. `not_allowed`), plus the plain-English message for each code. |
| `database.types.ts` | TypeScript types for the tables and functions, so `db.from('orders')` and `db.rpc(...)` are type-checked. |

The screens don't call `api.ts` directly. They go through the store in
`app/src/store/orders.ts`, which caches orders, applies changes optimistically, and keeps the
cache in sync with the server (`startSync`, `sync`, `write`).

**`supabase/`**: the database. Migrations run in number order, and each one builds on the one before.

| File | What it does |
|---|---|
| `migrations/0001_config_profiles_auth.sql` | The `private` schema, the `app_config` table, the sign-up trigger that blocks emails outside the allowed domains, and the `profiles` table. |
| `migrations/0002_orders.sql` | The `orders`, `order_secrets`, `order_events` and `reports` tables, with their checks and indexes. Also makes `order_events` append-only. |
| `migrations/0003_functions.sql` | Every database function: helpers, the "who is calling" checks, and all the order actions. |
| `migrations/0004_rls_and_grants.sql` | Turns on RLS, removes all write access, adds the read policies, and decides which functions the app may call. |
| `migrations/0005_realtime.sql` | Adds `orders` to Supabase Realtime so phones get live updates. |
| `migrations/0006_pin_search_path.sql` | Security hardening: pins `search_path` on the constant helpers. |
| `migrations/0007_fix_upi_check.sql` | Fixes the UPI-id check (Postgres caps regex repeats at 255). |
| `migrations/0008_notify_pin_lock.sql` | `verify_handover` now wakes the customer's screen when the PIN locks. |
| `migrations/0009_dropoff_is_profile_block.sql` | `place_order` always uses the customer's own block as the drop-off and no longer accepts one from the app. |
| `tests/0001_rls_and_functions.sql` | End-to-end test: fakes four users, tries allowed and forbidden actions, prints PASS/FAIL. Everything is rolled back afterwards, so it's safe to run on the live project. |

## 2. Tables

| Table | One line |
|---|---|
| `app_config` | Admin settings (for now, just the allowed email domains). No app access at all. |
| `profiles` | One row per student: reg number, name, phone, hostel block, UPI id. You can read only your own. |
| `orders` | The public part of a delivery: pickup point, size, fare, status, timestamps. You can read your own orders, your courier jobs, and the open pool. |
| `order_secrets` | Pickup OTP, driver phone, handover PIN and wrong-PIN count. Nobody can read this table directly. |
| `order_events` | Append-only history of every order (placed, accepted, arrived…). Readable by the two people on the order. |
| `reports` | Problems reported on an order. You can read only the reports you filed. |

## 3. Database functions

Called by the app (`public` schema, granted to signed-in users):

| Function | One line |
|---|---|
| `save_profile` | Create or update my profile. The reg number can't be changed after the first save. |
| `quote_fare` | Price for a parcel size: ₹20 for S/M, ₹30 for L/XL. |
| `place_order` | Customer creates an order. The server sets the fare, platform, tracking id and drop-off block. |
| `accept_order` | Courier takes an open order. The first tap wins. Returns `ok`/`taken`/`missing`/`limit`/`own`. |
| `advance_order` | Courier moves `allocated → picked_up → on_the_way`. |
| `arrive_order` | Courier is at the door. The server creates a 4-digit PIN that expires in 5 minutes. |
| `refresh_pin` | Customer gets a fresh PIN, which also clears a lock-out. |
| `verify_handover` | Courier types the PIN and the database compares it. After 5 wrong tries the PIN locks. |
| `complete_order` | Courier slides to complete after the handover. Sets the order to `delivered`. |
| `cancel_order` | Customer cancels, but only before pickup. |
| `rate_order` | Customer gives 1–5 stars, once, after delivery. |
| `set_driver_phone` | Customer adds the platform driver's number while the order is live. |
| `report_order` | Report a problem. A customer report makes the order `disputed`; a courier report puts it back in the open pool. |
| `get_order_private` | Returns the secrets and the other person's details, only to the two people on the order. The courier never gets the PIN. |
| `release_stale_orders` | Housekeeping: returns orders to the open pool if the courier went quiet for 30 minutes. The app can't call it; it's meant for a scheduled job (pg_cron). |

Internal helpers (`private` schema, the app can't call them): `me` (signed in with an allowed
email), `member` (`me` plus a profile), `is_member` (true/false version used by RLS),
`email_allowed`, `log` (writes to `order_events`), `fare_for`, `platform_of`, `digits`,
`random_digits`, `touch_updated_at`, the triggers `gate_auth_email` and `events_append_only`,
and the constants `max_batch` (4), `max_open_orders` (5), `pin_ttl` (5 min),
`pin_max_attempts` (5) and `stale_after` (30 min).

## 4. Trace: "courier accepts an order"

Phone A is the customer (waiting on `SearchingScreen`). Phone B is the courier.

1. **Tap.** On phone B, `CourierJobScreen.tsx` → `onAccept` calls the store's `accept(orderId)`.
   (The floating + on `HomeScreen.tsx` calls the same `accept`.)
2. **Store.** `accept` in `app/src/store/orders.ts` first checks the cached order is still
   `ORDER_PLACED`. Then it runs `write(orderId, null, () => api.acceptOrder(orderId))`.
   `write` counts the call as in flight, so a background sync can't overwrite it halfway.
3. **API.** `acceptOrder` in `api.ts` sends `db.rpc('accept_order', { p_order: orderId })`.
   This is an HTTPS request to Supabase that carries phone B's sign-in token.
4. **Database: who is it?** `accept_order` in `0003_functions.sql` calls `private.member()`,
   which reads `auth.uid()` from the token. It rejects the call if B isn't signed in, has an
   email outside the allowed domains, or has no profile.
5. **Database: checks.** It locks per courier (`pg_advisory_xact_lock`), so two quick taps by
   B run one after the other. Then it returns `missing` if the order doesn't exist, `own` if
   B placed it, or `limit` if B is already carrying 4.
6. **Database: the race.** One `update orders set status = 'allocated', courier_id = B …
   where id = … and status = 'available'`. If another courier got there first, no row
   matches, and B gets `taken`. Only one update can ever win.
7. **Database: history.** `private.log(...)` adds an `accepted` row to `order_events`. The
   function returns `'ok'`.
8. **Back on phone B.** `accept` marks the order `AGENT_ASSIGNED` in the cache. `write` then
   calls `sync()` → `api.listOrders(7)`, so the screen shows what the server actually stored.
   `loadPrivate()` calls `get_order_private` to fetch the customer's name, phone and pickup OTP.
9. **Realtime.** The changed `orders` row is published (`0005_realtime.sql`). RLS
   (`orders_read` in `0004`) allows phone A to see it because A is the `customer_id`, so A
   receives it. Other couriers can no longer see it (it isn't `available` any more), so they
   receive nothing. Their 4-second poll in `startSync` removes it from their lists.
10. **Phone A.** `startSync` (started in `App.tsx`) → `subscribeOrders` callback →
    `applyRecords` → `toOrder` maps `allocated` to `AGENT_ASSIGNED`. `SearchingScreen.tsx` sees
    that the state is no longer `ORDER_PLACED` and calls `navigation.replace('Track', …)`.
    `loadPrivate()` fetches the courier's name, reg number, phone and UPI id.

## 5. Debugging

| Symptom | Where to look |
|---|---|
| App crashes on launch: "Missing EXPO_PUBLIC_SUPABASE_URL" | `app/.env` (copy from `.env.example`), read in `client.ts`. |
| "Use your VIT student email" at sign-in | `app_config.allowed_email_domains`; the trigger `gate_auth_email` in `0001`. |
| Sign-in code never arrives or always says "wrong" | Supabase dashboard → Auth logs; SMTP settings; `OTP_LENGTH` in `config.ts` must match the dashboard. |
| "Finish your profile first" | The user has no `profiles` row; `private.member()` in `0003`. |
| Profile save fails with "Check your details" | The check constraints on `profiles` (`0001`, UPI fixed in `0007`); the `hint` in the database error has the details. |
| Courier always gets "Someone else got there first" | The order isn't `available` any more; check its row in `orders` and its `order_events` history. |
| Other phone doesn't update | Is `orders` in the realtime publication (`0005`)? Can that user read the row (`orders_read` in `0004`)? Is `startSync` running (`App.tsx`)? |
| Taken order stays in another courier's list | Expected for up to 4 s: realtime can't announce rows that left your view. The poll in `startSync` removes it. |
| Name, phone or PIN missing on screen | `get_order_private` returns nothing to people not on the order; `loadPrivate` in `store/orders.ts` logs `get_order_private <code>`. |
| A button does nothing / "You can't do that on this order" | The function's `where` check didn't match (wrong user or wrong status) and it returned `false` / `not_allowed`. Read the function in `0003`. |
| "permission denied for table …" | Expected for direct writes: the app may only `select` (`0004`). Add or fix a database function instead. |
| "permission denied for function …" | The function isn't in the `grant execute` list in `0004` (new functions are locked by default). |
| Anything else | Run `supabase/tests/0001_rls_and_functions.sql` in the SQL editor and read which line says FAIL. Check the dashboard's Postgres and Realtime logs. |
