# OnMyWay — project handoff for Claude

**How to use this file:** open a new Claude Code session in the `OnMyWay` repo, and say *"Read `context/OnMyWay-Claude-Handoff.md` and pick up from where it left off."* This is the full state of the project as of **18 Sep 2026**, written down so nothing depends on chat history. It supersedes `context/Yadhush-Claude-Handoff.md` (the pre-rename version — still useful for the landing-page internals).

---

## 1. What OnMyWay is

A campus peer-to-peer delivery app for **VINHACK** (hackathon). A parcel sits at the main gate; someone is already walking past; OnMyWay matches the two.

- Product was called **Yadhush** until 18 Sep 2026. The old name survives only in `context/Yadhush-*.md`.
- Every student is **both** customer and courier — one account, a role switch in Profile.
- **Registration number is the identity** (VIT: `24BCE1234` style; email must be `@vitstudent.ac.in`).
- Matching is **first-come-first-served** — one atomic conditional write on an unassigned order; the second courier is told the job is taken.
- **Two OTPs, don't confuse them:**
  - **Platform pickup OTP** — the code Amazon/Flipkart gives the orderer; the courier *requests* it from the orderer to collect the parcel from the delivery driver at the gate. Entered by the customer at order time (optional).
  - **Handover OTP** — 6 digits, 5-minute expiry, generated when the courier arrives; the customer reads it, the courier types it; that closes the order.
- **Payment is out of scope** for the demo. The fare (₹40 Regular / ₹55 Large) is shown everywhere but never collected. The `PAID` state still exists in the types for later.

**Order state machine** (labels used verbatim in the UI):
`ORDER_PLACED → AGENT_ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY → ARRIVED → DELIVERED` (+ `CANCELLED`). `CONFIRMATION_RECEIVED` and `PAID` are defined but currently skipped: a confirmed handover goes straight to `DELIVERED`.

## 2. Repo layout

```
OnMyWay/
├── app/                 the phone app — Expo SDK 57 / React Native 0.86 / TypeScript strict
├── web/                 the earlier Next.js + Vite client with Supabase services (imported whole, NOT integrated, never run by me)
├── assets/logo/         the final logo (see §4)
├── context/             this file, the Yadhush handoff, landing-page build prompt, onmyway-walkthrough.html
├── docs/splash-options.html   the four splash directions we compared (B won)
├── OMW-onboarding-frames*.html  VexoPolo's UI frames v1–v5 — v5 is the source of truth for screens
└── README.md            folder guide + standing rules
```

GitHub: `(old repository, removed)`, branch `main`. Local repo identity is set to **Skylinebotlang** (`155626509+Skylinebotlang@users.noreply.github.com`) — that's this user's GitHub account. Commits end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

Team branches that existed: `Framework-+-Logo` (VexoPolo, merged into main), `feature/backend-supabase-integration` (a teammate, imported under `web/`, also available locally as branch `backend-supabase`). **Teammates should branch from `main` now** — the old branches were cut from a rewritten history and merge badly.

## 3. STANDING RULES — do not break

1. **Every app screen is 390 × 844.** No desktop layouts, no 16:9.
2. **Never white text on yellow.** Anything on a yellow fill uses `#1F1300`. Yellow as text: `#FBBF24` on dark, `#A16207` on light. The `Button` component enforces this — reuse it.
3. **The logo is final.** Use the PNGs in `assets/logo/` in every mockup, screen and splash. Never redraw it, never use a placeholder. (An earlier hand-drawn SVG was deleted — don't recreate it.)
4. **Don't change the landing-page animations** (`context/onmyway-walkthrough.html`) unless asked.
5. **Edit existing files when iterating** — don't fork `v2` copies.
6. **Never put `.claude/`, `node_modules/`, `.expo/`, `graphify-out/` in the repo.** All are gitignored.
7. The user does **not** want tool-config or "demo-only" affordances visible to the judging committee. No "clear demo orders" buttons, no dev toggles in the UI.

## 4. Design system

Amber on near-black. Tokens live in `app/src/theme/tokens.ts` and match the landing page exactly:

```
ground #0A0A0A · surface #171717 · line #232326
brand-a #FCD34D → brand-b #F59E0B (gradient, 135°) · on-brand #1F1300
brand-dark #FBBF24 (yellow as text on dark) · brand-light #A16207 (on light)
light #F1F1F1 · muted #737373 (frames use #8a8a90) · ink #F4F4F5
warning #EA580C · error #EF4444 · map pins: pickup #8B5CF6, drop-off #EF4444
```

Type: **Archivo** 800/900 for headings (`T kind="h1"` — frames use 26px, not uppercase, `letter-spacing -.02em`), **IBM Plex Sans** 400/500/600 body, **IBM Plex Mono** for numbers, state labels, eyebrows, tracking IDs. Fonts load via `@expo-google-fonts/*` in `App.tsx`.

Shared components (`app/src/components/`): `Screen` (ground bg, safe area, 16px gutters), `T` (typographic roles), `Button` (primary gradient / ghost / danger), `Field`, `Card`, `OtpInput`, `Logo` (`lockup` | `mark` | `full`), `OrderCard`, `Timeline`, `LiveMap` (react-native-maps on device, schematic on web).

**Logo assets** (`assets/logo/`): `onmyway-mark.png` (pin + MW), `onmyway-mark-160.png`, `onmyway-wordmark.png`, `onmyway-logo.png` (full, transparent), `onmyway-logo-gradient.png` (on `#0A0A0A`), `app-icon-1024.png`, `splash-1170x2532.png`. Copied into `app/assets/` where the app needs them. The gradient is `#FCD34D → #F59E0B` top-left → bottom-right; no glow, no shadow. There is **no** `#1F1300` (dark-on-yellow) version yet — ask before making one.

## 5. What the app does today (all verified in the browser, 18 Sep)

**Launch:** native splash (static logo) → **animated splash** (`SplashScreen.tsx`, "option B"): a little courier walks the mark left→right revealing it, hops down, turns, walks back with "OnMyWay" unrolling behind him — *to the gate and back*. ~3.5 s, plain RN `Animated`, plays on every launch.

**Onboarding (Frames 1–2):** Registration (name, reg no, VIT email, phone, hostel-block bottom sheet with Men's/Ladies segmented + search, ID "upload" that's just a toggle, trust note, Continue gated on validation) → OTP screen (**demo code is always `123456`**) → Role Choice (two halves: Deliver & earn / Get something delivered). Sign-in exists as a secondary path for returning users.

**Customer:** Home ("Something at the gate?", in-progress orders) → **Place your order (Frame 5)**: Regular/Large, pickup point (Main Gate / Amazon Pick Up Point), tracking ID (platform inferred from prefix: TBA→Amazon, FLP→Flipkart, MYN→Myntra), "needs an OTP to collect?" toggle. Drop-off is the student's own hostel block from their profile. Confirm button carries the fare. → Searching (rings; "keep searching in the background" exits) → Track (map + timeline + ETA) → Handover (the 6 digits, countdown, "get a fresh code" when expired, back-to-home) → Delivered (receipt).

**Courier:** Home is the **agent hub (Frame 3)**: "Where are you?" → pick Main Gate / Amazon Pick Up Point → empty state with the logo → accordion of orders waiting there (tracker ID → block, size tag; expands to platform / ordered by / drop-off / driver / phone / you earn) → "Accept & start pickup →". A floating **+** bottom-right jumps to the newest open order (badge = count). → **Pickup (Frame 4)**: order-details card, "Request OTP from <first name>" → 2 s later the platform OTP the customer typed appears → "I have the parcel" → "On my way" → "I've arrived" → type the customer's 6 digits → Delivered.

**Profile:** initials avatar, name · reg no · block, "Verified student", three live stats (delivered / ₹ earned / orders placed), role switch as two Frame-2-style cards with black glyphs, contact card, Sign out (**also wipes all orders** — the reset between judges).

**Mock layer** (`app/src/services/mock.ts`, `mockCourier.ts`): no backend. Everything is Zustand + AsyncStorage on the device. A **stand-in courier** accepts an unaccepted order after **2 minutes** and walks it through on timers, so a one-phone demo never stalls; a real courier on the same phone short-circuits it. Own orders are shown in the courier list so one phone can play both roles (a backend would exclude them).

## 6. How to run

```
cd app && npm install && npx expo start        # phone: scan QR with Expo Go
cd app && npx expo start --web                  # browser at http://localhost:8081
cd app && npx tsc --noEmit                      # typecheck (keep it at 0 errors)
```

Gotchas on this machine:
- **npm 12** breaks `create-expo-app` and `npx expo install` (they parse old npm output). Install packages with plain `npm install pkg@<version>`, taking versions from `node_modules/expo/bundledNativeModules.json`.
- Don't start Metro with `CI=1` — that disables file watching and you'll debug a stale bundle for ten minutes.
- The project sits inside **OneDrive**; `node_modules` makes it churn. Tolerable so far.
- Windows Store Python can't write under `AppData\Roaming` — write to the scratchpad and copy.
- The Claude browser pane crops the right edge of the 390px viewport; that's the pane, not the app.

## 7. One-phone demo script (~3 minutes)

1. Profile → **Sign out** (clean slate) → splash plays → Register (any name, `24BCE1234`, `x@vitstudent.ac.in`, phone, pick a block, tap the ID box) → Continue → OTP `123456` → **Get something delivered**.
2. **Ask for a pickup** → Large, Amazon Pick Up Point, tracking `TBA5567123890`, OTP on, type `582914` → Confirm → **Keep searching in the background**.
3. Profile → **Deliver & earn** → Home → tap **Amazon Pick Up Point** → expand the order → **Accept & start pickup →**.
4. **Request OTP from <name>** → `582914` appears → I have the parcel → On my way → I've arrived.
5. Profile → Get delivered → Home → tap the order → read the six digits.
6. Profile → Deliver & earn → Home → Amazon → Continue pickup → type the digits → **Verify handover** → Delivered. Profile now shows 1 delivered · ₹55 earned.

## 8. Known gaps / not yet done

- **Never run on a real phone.** Only the web build has been exercised. Map, fonts, splash timing and Android emoji rendering (🛵📦 on Role Choice) are unverified on device. **Do this first.**
- No backend: two phones can't see each other. the earlier `web/` has Supabase schema + services (`web/client/src/services/supabase.ts`, `types.ts`) that could replace `app/src/services/mock.ts` — the service layer is shaped for that swap. His `web/client/src/supabase.ts` hardcodes the anon key; should move to `.env`.
- Driver name/phone on the pickup card are placeholders ("Ramesh K." / "Amazon Logistics").
- ID upload is a toggle, not a camera (`expo-image-picker` when needed).
- Tab bar icons are still letters in boxes (H / O / P) — cheapest remaining "prototype" tell.
- Customer Home is thin: no greeting with block, no live map, no sign of life. Brutal review from 18 Sep listed this as #1; Profile (#10) was fixed, frames 3–5 fixed much of the courier side (#4, #5, #8).
- My Orders is a flat, ungrouped list. No empty/loading/error states beyond the basics. Cancel mid-delivery and multi-order-per-courier are untested.
- Untested: killing the app mid-flow (state is persisted, should recover).

## 9. Other artefacts

- **Figma:** `https://www.figma.com/design/ZsVq8Kr8G24urdLTLnrjdo` (VINHACK team) — Frames 1, 1b (block sheet), 2 as real auto-layout. Frames 3–5 and the splash storyboard are **not** in Figma yet.
- **Landing page:** `context/onmyway-walkthrough.html`, rebranded from Yadhush, real logo embedded as base64 in the hero and sign-in screen; doctype/charset were added. Its animation rules are in the Yadhush handoff §5.
- **graphify** is installed (`uv tool install graphifyy`; `/graphify` skill registered in `~/.claude/`); a code graph was built once into `graphify-out/` (gitignored). `graphify update .` refreshes it.
- **Claude memory** for this user records: the logo is fixed; app-first priority; project path `C:\Users\yadhu\OneDrive\Desktop\OnMyWay`.

## 10. How the user likes to work

- Direct, fast, non-technical explanations when asked ("explain in non tech terms"). Show things running in the browser pane rather than describing them.
- Wants brutal honesty on design quality; then picks one item and says "come to that now".
- Push to GitHub when asked ("push it") — and say the commit hash. Don't push tool config.
- Will not accept fabricated process/evidence for the committee — was declined once, don't offer it. AI-assisted is fine to say; the concept, rules, logo and frames are genuinely theirs.
