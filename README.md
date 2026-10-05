# OnMyWay

Campus peer-to-peer delivery app, built for VINHACK.

## The idea in one line

A parcel sits at the main gate. Walking there and back is twenty minutes. Someone else is already walking past. OnMyWay matches the two.

## Standing rules (from the handoff — do not break)

1. Every app screen is **390 × 844** (iPhone). No exceptions.
2. **Never white text on yellow.** On yellow fills use `#1F1300`. Yellow as text: `#FBBF24` on dark, `#A16207` on light.
3. Don't change the landing-page animations unless explicitly asked.
4. Edit existing files when iterating; don't fork new ones.

## Logo — final, use everywhere

The logo is fixed (designed 18 Sep 2026). **Every mockup, screen, splash and lockup uses these files — no placeholders, no redrawn marks.**

| File | Use |
|---|---|
| `assets/logo/onmyway-mark.png` | pin + MW mark — headers, lockups next to the wordmark |
| `assets/logo/onmyway-mark-160.png` | same, 160px wide — small lockups, base64 embeds |
| `assets/logo/onmyway-wordmark.png` | "OnMyWay" wordmark only |
| `assets/logo/onmyway-logo.png` | full lockup, transparent background |
| `assets/logo/onmyway-logo-gradient.png` | full lockup on flat `#0A0A0A` (1322×800) |
| `assets/logo/app-icon-1024.png` | app icon |
| `assets/logo/splash-1170x2532.png` | 390×844 @3x splash |

Colouring: brand gradient `#FCD34D → #F59E0B`, top-left to bottom-right, on `--ground`. No glow, no shadow. A `#1F1300` variant for yellow surfaces doesn't exist yet.

## Design tokens

```css
--ground:#0A0A0A; --surface:#171717; --line:#232326;
--brand-a:#FCD34D; --brand-b:#F59E0B; --on-brand:#1F1300;
--brand-dark:#FBBF24; --brand-light:#A16207;
--light:#F1F1F1; --muted:#737373; --ink:#F4F4F5;
```

## Order state machine

`ORDER_PLACED → AGENT_ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY → ARRIVED → CONFIRMATION_RECEIVED → PAID → DELIVERED` (+ `CANCELLED`)

## Stack

React Native + Expo · Zustand (`persist`) · React Navigation (stack + 3 tabs: Home / My Orders / Profile) · Supabase (Postgres with RLS, email-code sign-in, realtime, private Storage bucket for ID cards)

## Priority (18 Sep 2026)

**1. Make the app work.** Everything else (landing page polish, design canvas) is secondary until there is a running Expo app that walks the core loop end to end.

Build order:
1. Expo scaffold + theme (tokens from below) + navigation shell (stack → 3 tabs: Home / My Orders / Profile)
2. Auth: student email → 6-digit code → role toggle
3. Order store (Zustand + persist) and the state machine
4. Place order flow (size, route, fare) → searching
5. Courier side: online toggle, open orders, atomic Accept (second tap gets "taken")
6. Tracking screen + timeline
7. OTP handover (6 digits, 5-min expiry) → payment → delivered
8. Polish, then demo run-through

## Status

Prototype in active development. Not production-ready.

## Contributors

- [@Skylinebotlang](https://github.com/Skylinebotlang)
- [@VexoPolo](https://github.com/VexoPolo)

## Folders

- `app/` — the phone app (Expo / React Native). `cd app && npm install && npx expo start`
- `supabase/` — the backend: schema, RLS and database functions (`supabase/migrations/`), plus an end-to-end SQL test (`supabase/tests/`)
- `assets/logo/` — the logo
- `docs/` — design explorations and the screen gallery (`docs/onmyway-screens.html`)
- `OMW-onboarding-frames*.html` — VexoPolo's UI frame iterations (v1–v5)

## Folder layout

```
OnMyWay/  (project root)
├── app/            the phone app
│   ├── App.tsx
│   └── src/        components, screens, navigation, store, services/backend
├── supabase/
│   ├── migrations/ schema, RLS, database functions (numbered)
│   ├── scripts/
│   └── tests/
├── assets/logo/    the logo — see above
└── docs/
```
