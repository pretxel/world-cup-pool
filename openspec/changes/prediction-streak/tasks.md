## 1. Pure streak function

- [ ] 1.1 Add `lib/prediction-streak.ts` exporting `computePredictionStreak(submittedAt: string[], now: Date = new Date()): number`, mirroring `computeStreak` in `lib/quiz.ts` (UTC day keys, anchor at today/yesterday, consecutive run backwards, dedupe same-day, normalize offsets), with no Supabase or framework imports and an injectable `now`.
- [ ] 1.2 Add a Monday-anchored UTC week-bounds helper (current week `[startOfWeek, nextWeek)` derived from `now`) and filter `submittedAt` to that half-open window before the consecutive-day scan, so the streak resets weekly and can never exceed 7.
- [ ] 1.3 Add a JSDoc comment block documenting the semantics and the weekly-reset / Monday-UTC anchor decision, matching the style of `computeStreak`.

## 2. Surface on My Picks

- [ ] 2.1 In `app/[locale]/(app)/my-picks/page.tsx`, compute the streak from the already-fetched `picks` (`computePredictionStreak((picks ?? []).map((p) => p.submitted_at))`) without adding a new query.
- [ ] 2.2 Render a fourth header `Stat` for the streak using the existing `Stat` helper and the `FlameIcon` pattern from `quiz/page.tsx` (colored when `streak > 0`, muted otherwise); keep the stat grid responsive across breakpoints. Read the relevant Next.js guide in `node_modules/next/dist/docs/` before editing the route component.

## 3. i18n strings

- [ ] 3.1 Add the new `myPicks` strings (streak stat label and any helper copy) to `messages/en.json`.
- [ ] 3.2 Translate the new `myPicks` strings in `messages/es.json`, `messages/fr.json`, and `messages/de.json`.

## 4. Tests

- [ ] 4.1 Add `tests/prediction-streak.test.ts` mirroring the `computeStreak` cases in `tests/quiz.test.ts` (empty, consecutive ending today, today-not-yet-predicted alive, missed in-between breaks, dedupe same day, non-UTC offset normalization) with an injected `now`.
- [ ] 4.2 Add weekly-reset cases: prior-week picks excluded, fresh Monday returns 0, and the streak is capped at the days elapsed in the current week (≤ 7).

## 5. Verification

- [ ] 5.1 Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`; fix any failures.
- [ ] 5.2 Manually verify `/my-picks` renders the streak stat (active flame for a current streak, muted flame at 0) for a signed-in user, that no extra DB query is issued, and that the label renders correctly under each locale (en, es, fr, de).
