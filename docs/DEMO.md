# OnMyWay — 2-minute demo

Two phones: **A = customer**, **B = courier**. Both on the same build, both online.

## Before you start

- Two test accounts that already exist and can sign in (use made-up names, never a real student's details).
- Account B's ID must already be approved (`profiles.id_status = 'approved'`), or the server refuses its accepts with "Your student ID needs to be approved before you can deliver."
- No open orders left over from rehearsal on either account.
- Phone B: role **Deliver & earn**. Phone A: role **Get something delivered**. (Switch on the Profile tab if needed.)

## Path 1 — sign-in to delivered (~90 s)

| # | Phone | Tap / do | Expected screen |
|---|---|---|---|
| 1 | A | **Sign in** → type the VIT email → **Send me a code** | "Sign in", then the code screen |
| 2 | A | Type the code from the email (it submits by itself, or **Verify**) | Customer home: "Something at the gate?" |
| 3 | B | Same sign-in steps | Courier home: "Where are you?" |
| 4 | A | **Ask for a pickup** | "Place your order" |
| 5 | A | Pick a size, pickup point, tracking ID (e.g. `TBA0000000001`), optional OTP → **Confirm order · ₹N** | "Finding a courier" · `ORDER_PLACED` |
| 6 | B | Tap the same pickup point as step 5 | The new parcel appears in the list for that point |
| 7 | B | Tap the parcel row to open it → **Accept & start pickup →** | "Pick up the parcel" |
| 8 | A | (nothing) | Switches by itself to the tracking screen; **Cancel order** visible |
| 9 | B | **I have the parcel** → **On my way** → **I've arrived** | "Your job"; buttons change at each step |
| 10 | A | (nothing) | "Four digits" — a 4-digit code with an expiry timer |
| 11 | B | Type A's four digits → **Verify handover** | "Collect from {name}" · ₹N |
| 12 | A | (nothing) | "Handed over" — "Pay {name} now — cash, or their UPI" |
| 13 | B | Drag the slider (›) all the way right | "Collected ₹N" · `DELIVERED · order closed` → **Done** |
| 14 | A | (nothing) | "Delivered" — "N min door to door · paid at the door" |

## Path 2 — cancel after accept (~30 s)

| # | Phone | Tap / do | Expected screen |
|---|---|---|---|
| 1 | A | **Ask for a pickup** → fill in → **Confirm order** | "Finding a courier" |
| 2 | B | Tap the pickup point → open the parcel → **Accept & start pickup →** | "Pick up the parcel" |
| 3 | A | On the tracking screen: **Cancel order** | Sheet: "Cancel this order?" |
| 4 | A | **Cancel order** in the sheet | Back to home; order is gone from In progress |
| 5 | B | (nothing) | Back to "Where are you?" with the line "The customer cancelled this order." |

Cancelling is only allowed before pickup: once B taps **I have the parcel**, the button disappears on A.

## If something goes wrong on stage

- Code email slow: tap **Back** and resend, or use a pre-signed-in phone.
- An accept says the order was taken: someone else (or a stale order) got it; place a fresh one.
