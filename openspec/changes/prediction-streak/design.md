## Context

The quiz already proves the streak pattern end to end. `lib/quiz.ts` exposes a pure `computeStreak(answeredAt: string[], now = new Date()): number` that maps timestamps to UTC day keys, anchors at today (or yesterday if today is unanswered), and counts the consecutive unbroken run backwards. `quiz/page.tsx` calls it with `quiz_answers.answered_at` and renders the value next to a `FlameIcon` (orange when `> 0`, muted otherwise) inside a `Stat` card. `tests/quiz.test.ts` covers the function in isolation with an injected `NOW`.

Predictions have the matching raw material. `predictions.submitted_at` is a timestamptz (`lib/database.types.ts`) and is already selected on `/my-picks` (`my-picks/page.tsx`), where the page also already renders three header `Stat` cards (Picks / Exact / Points) and has a private `Stat` helper. So a prediction streak is a near-mechanical mirror of the quiz streak that needs no new query and no schema.

The one new requirement from M8 is the **weekly reset**: the streak is scoped to "días con ≥1 pick, reset semanal". Unlike the quiz streak (which runs unbounded), the prediction streak only counts days inside the current week, so it can never exceed 7 and starts fresh every week — a deliberately reachable, short-horizon hook for mid-tier players.

## Goals / Non-Goals

**Goals:**
- A pure `lib/prediction-streak.ts` with an injectable `now`, no Supabase or framework imports, unit-testable like `lib/quiz.ts`.
- Mirror `computeStreak` semantics: UTC day keys; consecutive run ending today or yesterday; today-not-yet-predicted does not break the streak; a missed in-between day breaks it; multiple picks on one UTC day count once; timezone offsets normalized to the UTC day.
- Weekly reset: only `submitted_at` values within the current UTC week (Monday 00:00:00Z through the following Monday) count, so the streak resets each week and is capped at the days elapsed in the week.
- Surface the value on `/my-picks` with the same flame treatment as the quiz, using strings localized in en, es, fr, de.
- Add it with zero extra DB round-trips (compute from the `picks` already fetched).

**Non-Goals:**
- No streak persistence, schema column, or denormalized counter (compute on read only).
- No streak freeze / weekly pass (`análisis.md` "Apuestas grandes" — separate, larger bet).
- No prediction-streak leaderboard, share/OG card, email, or push surface in this change (leaderboard and share are listed only as optional surfaces in the task; the in-app `/my-picks` stat is the committed deliverable).
- No change to scoring, locking, or the quiz streak.

## Decisions

- **Compute on read, no schema.** The streak is a deterministic function of `predictions.submitted_at`, which is already loaded on `/my-picks`, so persisting it would only add drift and migration cost. This matches how the quiz streak works today.
- **Mirror, don't share, the quiz function.** `computeStreak` is unbounded; the prediction streak needs a weekly window. Rather than overload the quiz signature with a flag (and risk regressing `/quiz`), add a sibling `computePredictionStreak(submittedAt, now)` in a new file. The two stay independently testable and the quiz path is untouched.
- **Week boundary = ISO week, UTC, Monday-anchored.** "Reset semanal" needs one fixed anchor. Use Monday 00:00:00Z as the week start (a single helper deriving the current week's `[start, end)` bounds from `now`), filter `submittedAt` to that window before running the consecutive-day scan. Because the scan still anchors at today/yesterday, a fresh Monday with no pick yet yields 0 (today unanswered, yesterday is last week → outside the window → breaks), which is the intended reset behavior.
- **Surface location: `/my-picks` header stat.** The page already has the `Stat` grid, the `picks` data, and the `FlameIcon` precedent on `/quiz`. Reuse the existing `Stat` helper; render a flame colored by `streak > 0`. The header grid grows from three to four cells; keep it responsive with the existing Tailwind grid classes.
- **i18n in the existing `myPicks` namespace.** Add a stat label and a short helper line; no new namespace.

## Risks / Trade-offs

- **No DB migration, cron, or Realtime is required by this change.** It is pure read-time computation over already-fetched rows; explicitly calling this out because the M-series siblings (e.g. realtime-leaderboard, segmented-leaderboard) do need migrations/Realtime and this one deliberately does not.
- **Week-anchor convention is a product choice.** Monday-anchored UTC week is fixed for everyone regardless of locale/timezone, identical to how the quiz streak uses UTC days. A user in a far timezone may see the streak roll over at a non-local midnight; accepted for parity with the existing quiz behavior and simplicity. Documented in the spec.
- **Header crowding on small screens.** A fourth stat narrows each card on mobile. Mitigated by keeping values compact (single number + small flame) and relying on the existing responsive grid; verified manually under the verification task.
- **Streak cap of 7 may feel low to power users.** This is intentional per M8 ("reset semanal") to keep the hook reachable; a longer-horizon all-time streak is out of scope and can be a follow-up.
