# BUILD PROMPT — Yadhush scroll-driven landing page

*Paste everything below the line into Claude (or any capable coding model). It is written to be executed, not discussed.*

---

## ROLE

You are a senior front-end engineer and art director. You build scroll-driven marketing sites the way award-site studios do: one idea per viewport, a single hero object that transforms as you scroll, and motion that is driven by scroll position rather than triggered by it.

## DELIVERABLE

**One self-contained HTML file.** All CSS in a single `<style>`, all JS in a single `<script>`, no build step, no framework, no bundler.

- No external scripts. No React, no GSAP, no Lenis, no Three.js. Every effect below is achievable in ~250 lines of vanilla JS.
- The only external request allowed is one Google Fonts stylesheet.
- All graphics are CSS or inline SVG. No image files, no video files, no icon fonts.
- Total page weight under 300 KB.
- Must work with zero console errors on first load.

## THE PRODUCT

**Yadhush** — peer-to-peer campus delivery. A parcel sits at the main gate; walking there and back is twenty minutes. Someone else is already walking past. Yadhush matches the two. Every user is both customer and courier; a toggle in the profile switches the role. Fare is quoted before the order is placed and goes to the courier.

Order state machine, used verbatim as on-screen labels: `ORDER_PLACED` → `AGENT_ASSIGNED` → `PICKED_UP` → `OUT_FOR_DELIVERY` → `CONFIRMATION_RECEIVED` → `PAID` → `DELIVERED`.

Mechanics worth naming in copy: registration number is the identity; first-to-accept is settled by one atomic conditional write, so a second courier is told the job is taken; handover is proved by a 6-digit code with a five-minute expiry; payment clears only when the gateway webhook confirms.

## DESIGN TOKENS — use these exact values

```css
--ground:#0A0A0A;  --surface:#171717;  --line:#232326;
--brand-a:#FCD34D; --brand-b:#F59E0B;  --on-brand:#1F1300;
--brand-dark:#FBBF24;  /* brand as TEXT on dark */
--brand-light:#A16207;  /* brand as TEXT on light */
--light:#F1F1F1;   --muted:#737373;    --ink:#F4F4F5;
```

**Non-negotiable contrast rule: never put white text on yellow.** White on `#F59E0B` measures 2.15:1 and fails WCAG AA outright. Anything sitting on a yellow fill uses `--on-brand` (`#1F1300`, 8.49:1). Yellow used as text sits on the dark ground as `--brand-dark`, or on the light section as `--brand-light`. Yellow is the only accent colour in the page — no second hue, except the two map pins (`#8B5CF6` pickup, `#EF4444` drop-off).

**Type:** Archivo 600/800/900 for display, IBM Plex Sans 400/500/600 for body, IBM Plex Mono 400/500 for numbers, state labels and eyebrows. Headings are uppercase, `font-weight:900`, `letter-spacing:-.03em`, `line-height:.92`, sized `clamp(32px,4.6vw,62px)`. Body is 16px / 1.62 / `#9b9ba2`, capped at `max-width:40ch`.

**Surface treatment:** a repeated clipped-corner motif — `clip-path:polygon(0 22px,22px 0,100% 0,100% calc(100% - 22px),calc(100% - 22px) 100%,0 100%)` on the yellow bands and the light section. Cards are `--surface` on a 1px `--line` border, radius 14px.

---

# THE FOUR INTERACTIONS — build these exactly

## 1. Real smooth scroll (wheel interception + eased scroll position)

`html{scroll-behavior:smooth}` is **not** smooth scroll. It only animates anchor jumps and does nothing for the wheel. Implement it properly:

- Keep a `target` scroll value and a `current` value.
- On `wheel` (only when `matchMedia('(pointer:fine)').matches` — never hijack touch, which already has momentum): `preventDefault()`, add `deltaY * 1.05` to `target`, clamped to `[0, scrollHeight - innerHeight]`. Normalise `deltaMode`: `1` (lines) × 18, `2` (pages) × innerHeight.
- Bail out without preventing default when `ctrlKey`, `metaKey` or `shiftKey` is held — those are zoom and horizontal scroll.
- In a rAF loop: `current += (target - current) * 0.115`, then `window.scrollTo(0, current)`. Stop the loop when the gap drops below 0.45px, snapping to `target`.
- Because this drives the **real** `scrollTop`, `position:sticky` keeps working. Do not fake scrolling by transforming a wrapper — that breaks sticky and every layout below it.
- Listen to `scroll` as well and, when the eased loop is *not* running, resync `target = current = pageYOffset` so scrollbar drags, keyboard, and anchor links stay in sync. **The scroll listener must also fire the frame update** — this is the single easiest bug to ship: if only the wheel loop calls the updater, keyboard and touch scrolling leave the page frozen.

## 2. One pinned phone, ten screens, scroll-linked cross-fade

This is the centrepiece. **Do not build ten sticky panels each holding its own phone.** Build one phone that stays and swaps its contents.

Structure:

```
.rig                 position:relative; height: calc(var(--unit) * TOTAL_UNITS + 100svh)
  .dev               position:sticky; top:0; height:100svh; overflow:hidden
    .copycol         left column — ten absolutely stacked copy layers
    .phonecol        right column — the device
      .device        one iPhone frame
        .vp          the viewport: ten absolutely stacked .screen layers
```

`--unit: 86svh` on desktop, `76svh` under 900px.

Weights: every screen gets `1` unit of scroll except the opening conversation screen, which gets `2.8` — the messages need room to play. `TOTAL_UNITS` is the sum; each screen's start offset is the running total.

Per frame, from the rig's `getBoundingClientRect()`:

```
p = clamp(-box.top / (box.height - innerHeight), 0, 1)
t = p * TOTAL_UNITS            // position measured in screen-units
FADE = 0.30                    // cross-fade half-width, in units
for each screen i:
  hold = [START[i] + FADE, START[i] + W[i] - FADE]
  d    = distance from t to that interval (0 while inside)
  opacity   = clamp(1 - d / (FADE * 2), 0, 1)
  shift     = clamp(d / (FADE * 2), 0, 1)
  dir       = t < hold.start ? +1 : -1
  transform = translate3d(0, dir * shift * 26px, 0) scale(1 - shift * 0.035)
  visibility = opacity < 0.01 ? hidden : visible
```

At the boundary between two screens both sit at 0.5 opacity — a true cross-fade, scrubbing in both directions, with no CSS transition involved. **Opacity is a function of scroll position, not a class toggle with a transition.** Dragging the scrollbar backwards must play the whole thing in reverse.

The copy column uses the identical maths with a `34px` shift, so the words and the screen change together as one move.

Throttle with a rAF flag (`if(!queued){queued=true;requestAnimationFrame(...)}`) — never write styles directly in the scroll handler. Set `will-change:opacity,transform` and `backface-visibility:hidden` on the layers.

## 3. The conversation, inside the same phone, scrubbed by scroll

Screen 00 is an iMessage thread and it lives **in the phone**, not in a card beside it. It is the hook: two flatmates, one of whom will not walk to the main gate.

- Chrome: contact header (avatar circle, name "Meera", subtitle "Block C · flatmate"), message area, and a fake `iMessage` input pill with a send arrow.
- Bubbles: incoming `#26262a` / `#EDEDEF` left-aligned; outgoing on the brand gradient with `--on-brand` text, right-aligned. 17px radius, tightened to 5px on the last bubble of a run. 9px gap between speakers, 3px within a run.
- The list is `margin-top:auto` inside an `overflow:hidden` flex column, so it fills from the bottom and older messages ride up out of frame exactly like a real thread.
- **Reveal is scrubbed, not timed.** Messages are `display:none` until the local progress within screen 00's band reaches them: `n = round(u * (count - 1))`. Add `display` first, then add the visible class on the next rAF so the `opacity`/`translateY(9px)`/`scale(.97)` transition actually fires. Scrolling back up removes them again.
- Include a three-dot typing indicator as one of the items in the sequence, just before the payoff message.

Script the thread to about sixteen messages. It must be funny and read like real people, not marketing copy — the friend nagging, the procrastinator negotiating with themselves ("ten each way. that's twenty minutes of my one life"), the flat refusal ("counterpoint: no"), the abrupt "hang on", the typing indicator, then "sorted. someone's walking past the gate right now, 8 min away", and it ends on "ok send me the link".

## 4. The device frame itself

Draw a real iPhone in CSS, 390×844 logical, scaled to fit the viewport:

- Wrapper sized `calc(390px * var(--ps))` by `calc(844px * var(--ps))`; the frame itself is absolutely positioned at 390×844 with `transform:scale(var(--ps));transform-origin:top left`. Never scale the wrapper itself — the layout box has to shrink too.
- `--ps` is set from JS on load and resize: `clamp((innerHeight - 120) / 844, .38, .76)` — use `- 300` under 900px, where the copy stacks above the phone.
- Bezel: `padding:11px`, `border-radius:58px`, `background:linear-gradient(150deg,#2c2c31,#131316 45%,#2a2a2f)`, `box-shadow:0 44px 90px -30px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.05)`. Two side buttons via `::before`/`::after`.
- Inside: viewport `border-radius:48px;overflow:hidden`, a 104×30 black dynamic island, a status bar (time / signal / battery drawn with a bordered box and an inset fill) and a home indicator — all `z-index:5`, `pointer-events:none`, drawn **once** above the screen stack so every screen inherits them.
- Screens pad `62px 22px 30px` to clear the status bar; the map screen is full-bleed with zero padding and passes under it.
- A soft radial brand glow behind the phone: `radial-gradient(120% 80% at 78% 50%, rgba(245,158,11,.07), transparent 62%)`.

---

# THE TEN SCREENS

Each is a finished 390×844 app screen — a real UI, not a component sheet, not a wireframe, not a screenshot in a box. Left copy column gets a mono number, an uppercase headline, one paragraph, and a mono state line.

| # | Screen | Copy headline | State line |
|---|--------|---------------|-----------|
| 00 | iMessage thread | It starts as a text | Scroll to play the thread |
| 01 | Sign in — reg number field (filled, brand border), password, gradient CTA, "We'll text a 6-digit code" | Sign in | Reg number is the identity |
| 02 | New order, step 2 of 5 — 5-dot stepper with 2 complete, S/M/L/XL size grid with M selected, pickup→drop-off route card, estimated fare ₹40, Continue | Describe the drop | `ORDER_PLACED` |
| 03 | Searching — concentric brand rings, "Finding a courier", `ORDER_PLACED` chip | It goes live | Broadcast to everyone online |
| 04 | Courier dashboard — greeting, big yellow "You're online" toggle card, open-order card with route, distance, fare and Accept, plus one greyed-out card marked TAKEN | Someone claims it | `AGENT_ASSIGNED` |
| 05 | Order timeline — courier avatar, four-step vertical tracker with the third live | Picked up | `PICKED_UP` |
| 06 | Live map (full-bleed inline SVG: road grid, building blocks, brand-yellow route path, purple pickup pin, red drop pin, courier puck) + floating ETA pill + bottom sheet with courier row and call button | Watch it move | `OUT_FOR_DELIVERY` |
| 07 | OTP handover — six boxes, three filled, expiry countdown, Verify | Six digits | `CONFIRMATION_RECEIVED` |
| 08 | Pay — amount ₹40, QR card drawn as inline SVG rects on white, Pay button | Pay | Webhook confirms · `PAID` |
| 09 | Delivered — brand check circle, total time, order/paid summary card | Delivered | `DELIVERED` · order closed |

The QR square and the toggle knob are the **only** pure whites in the dark part of the page; they are physical objects, not text surfaces.

---

# PAGE ORDER

1. **Hero** — lockup (40px dashed logo slot left empty for the real logo + wordmark), `clamp(46px,9.2vw,124px)` uppercase headline "The campus **is** the delivery fleet" with the verb in brand yellow, one-line subhead, CTA, and an animated scroll cue reading "Scroll — one phone, ten screens".
2. **The pinned rig** — all ten screens.
3. **Yellow marquee band** — clipped corners, "Eight minutes, not twenty ◆" repeated, sliding infinitely over 26s.
4. **Light section** (`--light` ground, clipped corners) — the courier side of the toggle, three cards, and three count-up stats (8 minutes / ₹40 / 100%) that animate once with a cubic ease-out over 1100ms when scrolled into view.
5. **FAQ** — `<details>` accordions with a `+` / `–` mono marker.
6. **Footer** — waitlist email field with inline success message, no network call.

**Intro curtain:** a full-bleed fixed panel with a CSS-3D spinning cube and the wordmark, fading out 1150ms after load.

**Corner-bracket hover reticle** on every primary button — four 13×13 brackets, `1.5px solid var(--brand-dark)`, sitting flush at the corners at rest and expanding **outward** to `-9px` while fading in, over `.17s cubic-bezier(.22,.8,.25,1)`, with opacity over `.14s`. Trigger on `:hover` *and* `:focus-within`.

**Progress rail:** fixed left, one 3px tick per screen, the active one turning brand gradient and growing to 30px. Visible only while the rig is on screen. Hidden under 900px.

---

# HARD RULES — these are the ones that get broken

1. **Reduced motion must not kill the page.** Scope `@media (prefers-reduced-motion:reduce)` to *continuous, looping* motion only: the marquee, the typing dots, the spinning cube, the scroll cue. The scroll-linked cross-fades and the eased scroll are the substance of the page and stay on. Killing `position:sticky` or every transition inside that query produces a completely dead site for anyone with the OS setting on — and a lot of people have it on without knowing.
2. **Every phone screen is 390×844.** Not 16:9, not a desktop browser chrome. This is a mobile app, always.
3. **No layout thrash.** Read geometry once per frame, write styles once per frame, inside one rAF.
4. **Degrade honestly.** Gate every hidden-then-revealed state behind a `.js` class added by script, so a JS failure renders a readable page rather than a blank one. Put a 5s failsafe on every IntersectionObserver reveal.
5. **Real semantics.** One `<h1>`. Decorative nodes get `aria-hidden="true"`. Focus rings stay visible (`:focus-visible` with a brand outline). The FAQ uses `<details>`, the form uses a real `<label>`.
6. **Performance budget.** Under 300 KB total, first paint under 1.5s, no asset over 100 KB. (The reference site this is modelled on ships 25 MB including a 19.9 MB video served to desktop — do not do any of that.)
7. **Mobile is a real layout, not a scaled desktop.** Under 900px the copy stacks above the phone, the phone scales down, the rail disappears, and the pinned rig keeps working.

---

# ACCEPTANCE CHECKLIST

Verify each of these before declaring it done:

- [ ] Wheel scrolling visibly eases; the page does not jump line-by-line.
- [ ] Keyboard, scrollbar drag and touch scrolling all still update the phone screens.
- [ ] Scrolling backwards plays every cross-fade and every message in reverse.
- [ ] At any boundary, two screens are visibly blended — not snapped.
- [ ] Messages fill the thread from the bottom and scroll up out of frame.
- [ ] The phone never changes position while its contents change.
- [ ] Zero console errors; zero external requests except the font stylesheet.
- [ ] With `prefers-reduced-motion: reduce` forced on, the page is still fully alive.
- [ ] No white text sits on any yellow surface anywhere.
- [ ] At 390px wide and at 1440px wide, nothing overflows horizontally.
