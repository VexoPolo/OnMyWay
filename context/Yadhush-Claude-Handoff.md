# Yadhush — project handoff for Claude

**How to use this file:** open a new Claude conversation, attach this file (plus `yadhush-walkthrough.html` if you want to keep working on the landing page), and say *"Read the handoff and pick up from where it left off."* Claude will have the full context of the project as of 17 Sep 2026 — decisions, design system, standing rules, and what's already built.

Claude has no way to import someone else's chat history, so this is the working substitute: everything from that conversation that matters, written down.

---

## 1. What Yadhush is

A campus peer-to-peer delivery marketplace, built as a mobile app (React Native / Expo).

A parcel sits at the main gate. Walking there and back is twenty minutes. Someone else is already walking past. Yadhush matches the two.

- Every user is **both** customer and courier — one account, a role toggle in Profile.
- **Registration number is the identity** and the proof you belong on campus. Reg number + password, then a 6-digit OTP.
- Matching is **first-come-first-served**: one atomic conditional write on an unassigned order. The second courier to tap Accept is told the job is taken.
- Handover is proved by a **6-digit code with a five-minute expiry**, read aloud by the customer and typed in by the courier. Neither side swaps phone numbers.
- Payment is **QR → UPI / Stripe → webhook**. The order only moves to `PAID` when the gateway confirms; webhooks are idempotent.
- Fare is quoted **before** the order is placed, scales with package size and distance, and goes to the courier. ~₹40 on a typical main-gate-to-block run.

**Order state machine** (used verbatim as on-screen labels):

`ORDER_PLACED` → `AGENT_ASSIGNED` → `PICKED_UP` → `OUT_FOR_DELIVERY` → `ARRIVED` → `CONFIRMATION_RECEIVED` → `PAID` → `DELIVERED` (plus `CANCELLED`)

**Stack:** React Native + Expo · Zustand with `persist` for the order store · React Navigation (stack + 3-tab dashboard: Home / My Orders / Profile) · JWT auth · presigned S3 URLs for ID upload · `react-native-maps` for tracking.

---

## 2. STANDING RULES — do not break these

1. **Every app screen is 390 × 844 (iPhone mobile).** Not 16:9, not desktop, not a browser frame. This applies to every mockup, every artboard, every demo, every request — no exceptions, no matter how the request is phrased.
2. **Never put white text on yellow.** White on `#F59E0B` measures 2.15:1 and fails WCAG AA outright; on `#FCD34D` it's 1.44:1. Anything sitting on a yellow fill uses `#1F1300` (8.49–12.65:1). Yellow used *as text* is `#FBBF24` on dark, `#A16207` on light.
3. **Don't change the animations** on the landing page unless explicitly asked. They were hard to get right and they're the point of the page.
4. Edit the existing file rather than creating a new one when iterating.

---

## 3. Design system (current — supersedes the original spec)

The project started from a purple/blue token set. That has been **replaced** by an amber/yellow system on near-black. Use these:

```css
--ground:#0A0A0A;   /* page / app background      */
--surface:#171717;  /* cards, fields              */
--line:#232326;     /* borders                    */
--brand-a:#FCD34D;  /* gradient start             */
--brand-b:#F59E0B;  /* gradient end, active border*/
--on-brand:#1F1300; /* the ONLY text colour on yellow */
--brand-dark:#FBBF24;  /* yellow as text, on dark  */
--brand-light:#A16207; /* yellow as text, on light */
--light:#F1F1F1;    /* light-section ground       */
--muted:#737373;    /* secondary text             */
--ink:#F4F4F5;      /* primary text on dark       */
```

Semantic roles: Warning `#EA580C` · Error `#EF4444` · Success is the brand gradient. Map pins are the only other hues: pickup `#8B5CF6`, drop-off `#EF4444`.

Primary buttons are `linear-gradient(135deg,#FCD34D,#F59E0B)` with `#1F1300` label, radius 11–13px, height 50–56px.
Cards are `--surface` on a 1px `--line` border, radius 14–16px.
The QR square and the toggle knob are the **only** pure whites in the dark UI — they're physical objects, not text surfaces.

**Type (web/landing):** Archivo 600/800/900 display (uppercase, weight 900, `letter-spacing:-.03em`, `line-height:.92`), IBM Plex Sans 400/500/600 body, IBM Plex Mono for numbers, state labels and eyebrows.
**Type (app):** system font (SF Pro / Roboto) or Inter. headingLarge 32 · title 24 · subtitle 18 · body 16 · caption 12.
**Spacing** 4 / 8 / 16 / 24 / 32. **Radii** 6 / 12 / 16.

**Signature interaction — corner-bracket reticle.** On hover/focus of a primary button, four 13×13 brackets (`1.5px solid #FBBF24`) sitting flush at the corners expand *outward* to `-9px` while fading in — `.17s cubic-bezier(.22,.8,.25,1)` for position, `.14s` for opacity. They expand, they don't just appear.

---

## 4. What already exists

**A. Design canvas** — six `.dc.html` artboards driven by a `canvas.json`:
`Main` (900×1290 foundations/token sheet) · `Auth` · `OrderPlacement` · `DeliveryAgent` · `Tracking` · `Payment` — the last five all 390×844 finished app screens. `Auth` is the dark "Nexus-style" login with the bracket reticle; the rest are amber on near-black. A 7-page A4 PDF export of these exists too.

**B. Technical summary** — a Claude doc covering the architecture, with a one-paragraph "the crux" lead at the top.

**C. The landing page** — `yadhush-walkthrough.html`, a single self-contained file, currently live as a Claude artifact. This is the active piece of work. Section 5 describes it.

**D. A full build prompt** — `Yadhush-Landing-Page-BUILD-PROMPT.md` reconstructs the landing page from scratch with every constant spelled out. If you'd rather rebuild than inherit, start there.

---

## 5. The landing page — architecture

One HTML file. No framework, no build step, no external scripts (one Google Fonts stylesheet is the only external request). All graphics are CSS or inline SVG. Under 300 KB.

**Page order:** hero → pinned device rig (the whole product flow) → yellow marquee band → light "courier side" section with count-up stats → FAQ accordions → waitlist footer. An intro curtain with a CSS-3D spinning cube fades out 1150 ms after load.

### The four interactions

**1. Real smooth scroll.** `scroll-behavior:smooth` only animates anchor jumps — it does nothing for the wheel, which is why the page felt unchanged until this was written properly. The page intercepts `wheel` (only when `matchMedia('(pointer:fine)')` — touch keeps its native momentum), tracks a `target` and a `current`, and eases `current += (target - current) * 0.115` in a rAF loop, calling `window.scrollTo`. Because it drives the *real* scrollTop, `position:sticky` keeps working. **Never** fake this by transforming a wrapper — that breaks sticky and everything under it.

**2. One pinned phone, eleven screens, scroll-linked cross-fade.** Not eleven sticky panels each holding a phone — *one* phone that stays put while its contents swap.

```
.rig      height: calc(var(--unit) * TOTAL_UNITS + 100svh)   /* --unit: 86svh desktop, 76svh mobile */
  .dev    position:sticky; top:0; height:100svh
    .copycol   11 absolutely stacked copy layers
    .phonecol → .device → .vp → 11 absolutely stacked .screen layers
```

Each screen gets 1 unit of scroll; the opening conversation screen gets 2.8 so the messages can play. Per frame:

```
p = clamp(-rigBox.top / (rigBox.height - innerHeight), 0, 1)
t = p * TOTAL_UNITS                       // position in screen-units
FADE = 0.30
hold_i    = [START[i] + FADE, START[i] + W[i] - FADE]
d         = distance from t to that interval (0 inside)
opacity   = clamp(1 - d / (FADE * 2), 0, 1)
transform = translate3d(0, ±shift*26px, 0) scale(1 - shift*0.035)
```

At each boundary both screens sit at 0.5 — a true cross-fade that scrubs in **both** directions. Opacity is a function of scroll position, not a class toggle with a CSS transition. The copy column runs identical maths with a 34px shift, so words and screen move as one.

**3. The iMessage thread, inside the same phone, scrubbed by scroll.** Screen 00 is the hook: two flatmates, one refusing to walk to the gate ("ten each way. that's twenty minutes of my one life" … "counterpoint: no" … "hang on" … typing indicator … "sorted. someone's walking past the gate right now, 8 min away"). Sixteen messages, `display:none` until local progress reaches them (`n = round(u * (count-1))`), added back to the flow and then faded in on the next rAF. The list is `margin-top:auto` in an `overflow:hidden` column, so it fills from the bottom and older messages ride up out of frame like a real thread. Scrolling up un-sends them.

**4. The device frame.** A CSS iPhone: 390×844 logical, `transform:scale(var(--ps))` with `transform-origin:top left` inside a wrapper sized `calc(390px * var(--ps))`. `--ps` is set from JS on load/resize: `clamp((innerHeight - 120) / 844, .38, .76)` (`- 300` under 900px, where the copy stacks above the phone). Bezel `padding:11px`, `border-radius:58px`, gradient shell, two side buttons via pseudo-elements. Dynamic island, status bar and home indicator are drawn **once** above the screen stack, so every screen inherits them.

### The eleven screens

| # | Screen | Headline | State |
|---|--------|----------|-------|
| 00 | iMessage thread | It starts as a text | — |
| 01 | Sign in (reg number, password) | Sign in | reg number is the identity |
| 02 | **Choose role** — "Ask for a pickup" (selected) vs "Deliver on campus", with mini-stats and a switch-roles note | Pick a side | one profile, both roles |
| 03 | New order, step 2 of 5 — stepper, S/M/L/XL, route card, fare | Describe the drop | `ORDER_PLACED` |
| 04 | Searching — concentric rings | It goes live | broadcast to everyone online |
| 05 | Courier dashboard — online toggle, open order with Accept, one greyed TAKEN card | Someone claims it | `AGENT_ASSIGNED` |
| 06 | Order timeline, third step live | Picked up | `PICKED_UP` |
| 07 | Live map (inline SVG), ETA pill, courier bottom sheet | Watch it move | `OUT_FOR_DELIVERY` |
| 08 | OTP handover, 3 of 6 filled | Six digits | `CONFIRMATION_RECEIVED` |
| 09 | Pay — ₹40, QR on white | Pay | `PAID` |
| 10 | Delivered — check, total time, receipt card | Delivered | `DELIVERED` |

### Two bugs that were shipped once — don't repeat them

- **A blanket `prefers-reduced-motion` block killed the page.** Scope it to *continuous, looping* motion only — marquee, typing dots, spinning cube, scroll cue. The scroll-linked cross-fades and the eased scroll must stay on. Killing `position:sticky` or every transition inside that query leaves a completely dead site for anyone with the OS setting enabled, and plenty of people have it on without knowing.
- **Only the wheel loop called the frame updater.** Keyboard, touch and scrollbar scrolling then left the phone frozen. The `scroll` listener must fire the update too.

---

## 6. Open / not yet built

- The app logo. Every lockup leaves a dashed 40×40 slot for it.
- Launch campus, pricing beyond the ₹40 illustrative fare, and whether couriers are paid per-run or pooled.
- None of the app itself is implemented — everything above is design, architecture and marketing. The 30-hour sprint plan in the original spec (auth → order store → agent toggle → map → OTP/payment → upload → polish → test) is still the roadmap.
