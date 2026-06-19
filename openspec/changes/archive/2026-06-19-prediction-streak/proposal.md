## Why

The streak mechanic — a consecutive-day counter with a flame that the user fears breaking — exists today only for the daily quiz (`computeStreak` in `lib/quiz.ts`, surfaced on `/quiz` with a `FlameIcon`). Predictions, the core loop, have no equivalent: scoring per match (5/3/1/0 in `lib/scoring.ts`) rewards accuracy but not constancy, so there is no daily reason to return on days without a big match. `análisis.md` flags this directly — "Racha confinada al quiz — no hay racha de predicciones diarias" (section 3), the broken-loop note "no existe racha en predicciones" (section 3, item 8), and the gamification catalog "Streak de predicciones diarias (reset semanal) — paralelo a la racha del quiz, hoy inexistente en predicciones" (section 5.E). This is engagement bet **M8** from "Apuestas medianas": a prediction streak counting consecutive days with at least one pick, with a weekly reset, to give a recurring habit hook.

The data already exists: `predictions.submitted_at` (timestamptz, see `lib/database.types.ts`) is selected today on `/my-picks` (`select("match_id, home_goals, away_goals, submitted_at, matches!inner(*)")` in `my-picks/page.tsx`). The streak can therefore be computed on read — no schema change — exactly as the quiz streak is derived from `quiz_answers.answered_at`.

## What Changes

- Add a pure, server-and-test-safe `lib/prediction-streak.ts` that computes the current prediction streak from the user's `predictions.submitted_at` timestamps, mirroring `computeStreak` in `lib/quiz.ts` (UTC day keys, consecutive run ending today or yesterday, missed in-between day breaks it, multiple picks the same day count once, injectable `now`) but adding a **weekly reset**: only picks within the current Monday-anchored UTC week count toward the streak, so the longest possible value resets each week and the streak is short-horizon by design (matching M8's "reset semanal").
- Surface the streak on `/my-picks` as a fourth header stat (alongside Picks / Exact / Points) using the same flame treatment as the quiz page: a `FlameIcon` colored when the streak is > 0, muted otherwise, with localized label and helper copy.
- Compute the streak from the `predictions` rows already fetched on `/my-picks` (the `submitted_at` column is already selected), so no extra query is added.
- Add i18n strings for the new stat label and helper copy across en, es, fr, de.

## Capabilities

### New Capabilities
- `prediction-streak`: a pure function derives a user's current prediction streak — the count of consecutive UTC days within the current week on which the user submitted at least one prediction — from `predictions.submitted_at`, computed on read with no schema, and surfaced in-app on `/my-picks` with a flame indicator to give a daily reason to return.

### Modified Capabilities

## Impact

- Code: new `lib/prediction-streak.ts` (pure, no Supabase import); `app/[locale]/(app)/my-picks/page.tsx` — compute the streak from the already-fetched `picks` and render a fourth `Stat`.
- Components: reuse the existing `Stat` helper and `FlameIcon` pattern from `quiz/page.tsx`; no new component required.
- Tests: new `tests/prediction-streak.test.ts` mirroring `tests/quiz.test.ts` (`computeStreak` cases) plus the weekly-reset cases.
- i18n: new strings in the `myPicks` namespace (stat label + helper) across `messages/{en,es,fr,de}.json`.
- No schema migration, no cron, no Supabase Realtime, no new dependency; rendering stays SSR like the current page.
