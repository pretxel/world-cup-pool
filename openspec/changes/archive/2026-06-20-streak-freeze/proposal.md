# Streak Freeze / Weekly Pass

## Why

Streaks are the app's strongest daily-habit hook, but today both of them have a
hard cliff: one missed UTC day silently zeroes the run. The daily-quiz streak
(`computeStreak` in `lib/quiz.ts`) counts consecutive UTC days with an answer,
and the prediction streak (`computePredictionStreak` in `lib/prediction-streak.ts`,
already shipped under the `prediction-streak` spec) counts consecutive UTC days
with at least one pick inside the current week. A single skipped day — travel,
a busy Tuesday, a timezone-late evening — resets weeks of momentum to zero, and
the loss is invisible until the user opens `/quiz` or `/my-picks` and sees the
flame go cold. That cliff is the dominant reason streaks die, and it punishes
exactly the engaged, near-daily users the product most wants to keep.

This change implements the engagement *apuesta grande* "Streak freeze / pase
semanal para no romper la racha por un día perdido (reduce el efecto cliff)"
(`análisis.md`, Apuestas grandes, and §5.E "Streak freeze / pase semanal —
segunda oportunidad para no romper la racha"). It adds a small per-user
freeze-token mechanism that automatically forgives a single one-day gap so a
streak survives, plus the UI that surfaces remaining freezes and when one was
spent — turning a silent loss into a recoverable, even rewarding, moment.

A defining constraint discovered in the code: neither streak is stored. Both are
**pure functions computed on read** from raw timestamps, with an injectable
`now`, no DB access, and no persisted counter. A freeze therefore cannot be a
one-shot mutation against a stored number; it must be a deterministic ledger of
freeze grants and consumptions that the pure functions consult so the computed
streak stays a stable, reproducible function of (timestamps, freezes, now).

## What Changes

- Add a per-user freeze ledger (new table) recording freeze grants (weekly
  refill) and the specific UTC day each freeze was consumed to bridge a gap,
  keyed by streak kind (`quiz` | `prediction`) so the two streaks have
  independent budgets.
- Extend the two pure streak functions to accept consumed-freeze days and treat
  a single forgiven gap day as not breaking the run, while preserving every
  existing behavior (UTC-day dedupe, timezone normalization, today-not-yet-
  done keeps the streak alive, the prediction streak's Monday-anchored weekly
  window and 7-day cap).
- Add a deterministic consumption step that, on read, detects a one-day gap
  ending today/yesterday and, if the user has an unused freeze for that kind,
  records the consumption (idempotently) so the same gap is never charged twice
  and the streak is preserved on every subsequent read.
- Grant a small weekly freeze allowance per kind (weekly pass), refilled on the
  same Monday-anchored UTC week boundary the prediction streak already uses, so
  budgets are bounded and reset predictably.
- Surface freezes in `/my-picks` and `/quiz`: a remaining-freeze indicator next
  to the flame and a "streak saved — a freeze was used" affordance when the most
  recent gap was bridged, localized for en/es/fr/de.
- Reflect the protected streak in the quiz reminder email, which already loads
  per-user streaks via `loadStreaks` (`lib/notifications/quiz-reminder-emails.ts`),
  so the reminder never tells a still-alive user their streak is gone.

## Capabilities

### New Capabilities

- `streak-freeze`: A per-user, per-kind freeze-token mechanism that
  deterministically forgives a single one-day gap so a quiz or prediction
  streak is not reset, with a weekly-refilled allowance, an idempotent
  consumption ledger consulted by the existing pure streak functions, and UI
  surfacing of remaining freezes and saved-streak moments on `/my-picks` and
  `/quiz`.

### Modified Capabilities

## Impact

- Affected specs: new `streak-freeze` capability. The `prediction-streak` and
  `daily-quiz` capabilities are touched only through the freeze-aware extension
  of their pure streak functions; their existing requirements remain valid.
- Affected code: `lib/quiz.ts` (`computeStreak`), `lib/prediction-streak.ts`
  (`computePredictionStreak`), a new freeze library (ledger access +
  consumption), `app/[locale]/(public)/quiz/page.tsx`,
  `app/[locale]/(app)/my-picks/page.tsx`,
  `lib/notifications/quiz-reminder-emails.ts`, and i18n message files
  (`messages/{en,es,fr,de}.json`).
- Database: one additive migration creating the freeze ledger table with RLS
  (owner-only read; writes via a `security definer` RPC or service path). No
  existing table is altered destructively.
- No new infra: no service worker, web push, VAPID, or new cron. The weekly
  refill and gap consumption are computed lazily on read inside existing request
  paths; no scheduled job is required.
- Competitive scoring: unaffected. Freezes touch only the engagement streak
  display and reminder copy; they never alter `scores`, points, ranking, or any
  leaderboard. A frozen streak confers no competitive advantage.
