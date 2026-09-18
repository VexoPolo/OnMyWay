# OnMyWay

Campus peer-to-peer delivery app for VINHACK. Expo/React Native app in `app/`.

**Start here:** read `context/OnMyWay-Claude-Handoff.md` — full project state, standing rules, demo script, known gaps.

Hard rules (details in the handoff §3):
- Every screen is 390×844.
- Never white text on yellow; on yellow use `#1F1300`.
- The logo in `assets/logo/` is final — use it everywhere, never redraw it.
- Keep `.claude/`, `node_modules/`, `graphify-out/` out of git.
- No demo-only buttons in the UI.

Run: `cd app && npm install && npx expo start`. Typecheck: `cd app && npx tsc --noEmit`.
On this machine use `npm install pkg@version` (npm 12 breaks `npx expo install`).
