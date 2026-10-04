# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Expo / React Native app in `app/`, shipped as a web app at https://onmyway-khaki.vercel.app and installable from the browser; the same code runs in Expo Go on phones. The design language is OnMyWay's own, not iOS/Android-native. Every screen is designed at 390×844.)

## Users

VIT Vellore hostel students, day one and only. Two roles on one account, switchable any time:

- **Requester** — a hostel resident whose Amazon/Flipkart/courier parcel is waiting at Main Gate or the Amazon Pick Up Point and who doesn't want to walk to the gate. Situation: in their block, often mid-day, checking the app in bursts. Job: get the parcel to the door for a small, fixed price without leaving.
- **Courier** — a student already walking back from the gate to a block. Situation: standing at the gate with a few minutes; wants to know what's waiting *here* and what it pays. Job: carry a parcel on the way they're already going and get paid in hand.

Both are verified students: reg number, VIT email, hostel block, ID card at registration.

## Product Purpose

Campus peer-to-peer parcel delivery: match a parcel waiting at the gate with a student who's walking past it anyway. Success = the parcel reaches the right person's door, proven by a handover PIN, and the courier is paid ₹20 (Regular) / ₹30 (Large) in cash or to their own UPI. Built for VINHACK (hackathon, Sept 2026); judged on a live two-phone demo.

## Positioning

**"Someone's already walking."** Not a courier service and not a hostel WhatsApp group: the person carrying your parcel was going to your block regardless, so the price is a flat ₹20–30, there is no fleet, no dispatch and no middleman, and the proof of delivery is a four-digit PIN read aloud at the door. A paid errand service can't claim the walker was already going; a chat group can't prove the handover.

## Operating Context

- Two pickup points: **Main Gate** and **Amazon Pick Up Point**. Amazon hands parcels over by tracking ID; the gate hands over by name and block, so the tracking ID is optional there.
- Platforms text the requester a **collection OTP** (4 digits) and sometimes a driver's phone; the requester types these in and the courier reads them out at the gate.
- Order lifecycle (shared vocabulary with the backend): placed → courier assigned → picked up → on the way → arrived → handover confirmed (PIN) → delivered. Plus cancelled and disputed.
- The courier's hub is location-first ("Where are you?") and shows only what's waiting at that point; a floating + takes the newest open order.
- Settlement happens at the door, outside the app: cash or the courier's personal UPI ID shown on the requester's pay screen, then a slide-to-complete on the courier's side.
- Either side can report a problem (late, unresponsive, not received, wrong/damaged, asked for more than the fare); the order becomes DISPUTED with both reg numbers attached for a campus admin.
- Demo ritual: two phones on the same Supabase project, one per role, walked live for judges.

## Capabilities and Constraints

- Backend: Supabase (`profiles`, `orders`, `order_secrets`, `order_events`, `reports`), realtime sync between phones, RLS on every table and all writes through database functions; sign-in is a 6-digit email code via Supabase Auth, limited to the domains in `app_config`.
- Pricing is by parcel class only (Regular ₹20, Large ₹30); no distance pricing.
- Progress is courier-tapped states; there is no GPS or live map. The track screen's map is schematic.
- Handover PIN: 4 digits, generated when the courier arrives, 5-minute expiry, verified by the database.
- Fraud/report flow exists in the UI; the admin side that receives reports does not exist yet.
- **Durable (user-confirmed):** the handover PIN is the proof of delivery — don't replace it with photos, signatures or GPS confirmation.
- **Current but not locked:** no in-app payments, no GPS, reports going to a campus admin. These are today's facts; the user did not commit to them as permanent.
- **Undecided:** real authentication (Supabase Auth or otherwise), the admin dashboard for disputes, whether the app expands beyond VIT.

## Brand Commitments

- Name: **OnMyWay** (short mark "OMW"). The logo in `app/assets/logo/` (mark, wordmark, lockup) is final and used everywhere; never redrawn.
- Voice: first-person-plural, warm, direct campus talk. Real lines: "Something at the gate?", "Someone is already walking past. Pay them a little to bring it back.", "Where are you?", "Read this to the courier. It proves the parcel reached the right person."
- Binding visual constraints the user set: dark ground, amber brand gradient; never white text on yellow (use #1F1300 on yellow); no demo-only buttons in the UI; every screen is 390×844.

## Evidence on Hand

- Working product: `app/` (Expo SDK 57), live at https://onmyway-khaki.vercel.app, synced to Supabase project `fikinghjzmnxgmvnibyk`.
- Screen mockups: `docs/onmyway-screens.html` and `docs/screens/*.html` (25 frames); Figma file `ZsVq8Kr8G24urdLTLnrjdo`.
- Media: `docs/media/onmyway-splash.mp4` (splash animation), `brag-output/brag.mp4` (21 s launch video).
- Schema: `supabase/migrations/` (tests in `supabase/tests/`).
- **No** real usage numbers, testimonials, courier counts or delivery times exist. Figures in the UI ("3 couriers online", "avg ₹25", "~20 min wait") are placeholders and must not be presented as data.

## Product Principles

1. **The walk is the product.** Every screen should make it obvious someone is already going that way; don't dress it up as logistics.
2. **Trust is a four-digit number.** The PIN moment is the emotional centre of the flow; everything around it (arrival, verify, pay) serves it.
3. **Two phones, one truth.** Whatever changes on one role's screen must be visible on the other within a second; state names are shared, not translated.
4. **Location before list.** A courier picks where they are first; the app only shows what's relevant to that spot.
5. **Nothing fake in the demo.** No stand-in couriers, no demo buttons, no invented numbers; if a figure isn't real, say so or leave it out.

## Accessibility & Inclusion

Used one-handed, outdoors at a gate, often in sun: text contrast ≥ 4.5:1 on the dark surfaces, 44pt targets, labels on every icon-only control, and a non-drag alternative for slide-to-complete (screen-reader activate action) are already in place and must be kept.
