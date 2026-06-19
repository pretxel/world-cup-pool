## 1. Countdown badge component

- [ ] 1.1 Provide a small client component for the row badge that reuses the existing tick/lock logic in `components/kickoff-countdown.tsx` (1s interval over `kickoff_at`, second-resolution `mm:ss` formatting, swap to a locked node at `remaining <= 0`) — either as a new variant/prop on `KickoffCountdown` or a thin sibling client component built on the same logic. It SHALL show the "closes in mm:ss" badge only while `0 < (kickoff − now) ≤ leadWindow` and otherwise render nothing (the row keeps its static "Pick" label).
- [ ] 1.2 Define the imminent lead window as a single named constant (5 minutes, matching `análisis.md` M1) so it can be tuned without touching markup.
- [ ] 1.3 When the countdown reaches zero, resolve to the locked label (reuse the existing `rowLocked` copy via `lockedNode`/`lockedLabel`) so the badge converges with what a fresh server render shows once `isLocked` flips.

## 2. MatchRowCard integration

- [ ] 2.1 In `app/[locale]/(public)/matches/page.tsx`, in `MatchRowCard`, add an imminent-lock branch in the trailing right-hand column: when `uiStatus === "scheduled"` and the user has not picked the fixture, render the countdown badge (it self-suppresses when not yet imminent); otherwise keep the existing "Pick" label. Leave the live ("on now"), locked, final-score, and picked branches unchanged.
- [ ] 2.2 Pass the badge the row's `kickoff_at`, the lead-window-aware behavior, and the localized strings; thread any new translation values through the existing per-row prop pattern (the page already passes `tKickoff`, `tFinal`, `tOnNow`, `tLocked`, `tPick`, `tPicked`).
- [ ] 2.3 Apply subtle urgency styling to the closing-soon row, visually distinct from the live `live-pulse` treatment and the muted locked treatment, using the row's existing Tailwind token vocabulary. Keep all other columns (time, stage badge, teams, venue, chevron) unchanged.

## 3. i18n

- [ ] 3.1 Add the closing-soon copy to the `matches` namespace in `messages/en.json` — e.g. `rowClosesIn` ("closes in {time}") and, if needed, `rowClosingSoon` for an accessible label — alongside the existing `rowPick` / `rowLocked` keys.
- [ ] 3.2 Add the same key(s), translated, to `messages/es.json`, `messages/fr.json`, and `messages/de.json`.

## 4. Verification

- [ ] 4.1 Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`; fix any failures.
- [ ] 4.2 Manually verify on `/matches`: a scheduled fixture within 5 minutes of kickoff shows the live "closes in mm:ss" badge and urgency styling in place of "Pick"; the countdown ticks each second; at kickoff the badge swaps to "Locked" with no reload; a fixture further than 5 minutes out shows the plain "Pick" label; live / locked / final / cancelled / already-picked rows are unchanged; and the badge copy renders correctly in all four locales (en, es, fr, de).
