# Tasks — Streak Freeze / Weekly Pass

Phased: data + pure-function core first (Phase 1–2), the read-path consumption
and UI next (Phase 3–4), email and polish last (Phase 5). Each phase is shippable
behind the data being present; the pure-function change is backward-compatible
(default empty freeze set) so it can land before any UI.

## 1. Schema & data model

- [ ] 1.1 **Migration:** add `supabase/migrations/<ts>_streak_freezes.sql`
      creating the per-user freeze ledger keyed by user + kind (`quiz` |
      `prediction`), recording weekly grants (by Monday-UTC `week_start`) and
      per-day consumptions (`consumed_day`), with a unique constraint on
      (`user_id`, `kind`, `consumed_day`) for idempotent consumption.
- [ ] 1.2 Add RLS: owner-only `select` (`user_id = auth.uid()`); no direct client
      insert/update/delete of grant or consumption rows.
- [ ] 1.3 Add a `security definer` RPC (or trusted server path) for the lazy
      weekly grant and the idempotent consumption insert, so freezes can only be
      minted/consumed server-side.
- [ ] 1.4 Regenerate Supabase types and add the table/RPC to `lib/db` typings.

## 2. Pure streak functions (freeze-aware)

- [ ] 2.1 Extend `computeStreak` in `lib/quiz.ts` to accept an optional
      `frozenDays: Set<string>` of consumed-freeze UTC day-keys; step over a
      single forgiven gap when counting; default empty preserves current behavior.
- [ ] 2.2 Extend `computePredictionStreak` in `lib/prediction-streak.ts` the same
      way, preserving the Monday-anchored weekly window and 7-day cap.
- [ ] 2.3 Unit tests: forgiven single gap bridges the streak; a two-day gap with
      one freeze still breaks; no freeze days reproduces current output exactly;
      a freeze at the natural run-end invents no activity; prediction weekly
      window/cap unaffected.

## 3. Freeze library & read-path consumption

- [ ] 3.1 Add `lib/streak-freeze.ts`: the weekly-amount constant, the shared
      Monday-UTC week boundary (reuse/mirror `currentUtcWeekBounds`), readers for
      remaining allowance and consumed-freeze days per user+kind, and an
      idempotent consume helper.
- [ ] 3.2 Implement on-read consumption: ensure the current week's grant exists,
      compute the unfrozen streak, detect an eligible single one-day gap
      (today/yesterday-anchored), consume one freeze if remaining, then re-read
      consumed days for display. Best-effort, never throws into render.
- [ ] 3.3 Unit/integration tests for the helper: eligible gap consumes once and is
      idempotent on re-read; no consume at streak 0, no remaining freeze, or
      anonymous; independent quiz/prediction budgets; week-boundary refill.

## 4. UI surfacing

- [ ] 4.1 `/my-picks` (`app/[locale]/(app)/my-picks/page.tsx`): call the freeze
      helper for the `prediction` kind, pass `frozenDays` into
      `computePredictionStreak`, and render remaining-freeze count beside the
      existing streak `Stat` plus a "streak saved" affordance when a freeze was
      used this week.
- [ ] 4.2 `/quiz` (`app/[locale]/(public)/quiz/page.tsx`): same for the `quiz`
      kind beside the quiz streak `Stat` (signed-in only).
- [ ] 4.3 Add localized copy to `messages/{en,es,fr,de}.json` for the
      remaining-freeze label and the saved-streak hint; verify zero-remaining and
      no-freeze-used states render cleanly with no error/empty state.

## 5. Email & verification

- [ ] 5.1 Quiz reminder email (`lib/notifications/quiz-reminder-emails.ts`):
      supply each recipient's consumed-freeze days to the streak computation in
      `loadStreaks` so the reminder reflects the protected streak; do not consume
      freezes from the email path; keep it best-effort.
- [ ] 5.2 Confirm no competitive-scoring impact: no writes to `scores`, no change
      to leaderboards/segmented RPCs/rank snapshots from any freeze code path.
- [ ] 5.3 Run `openspec validate "streak-freeze"`; run lint, typecheck, and the
      full unit-test suite; manually verify the `/my-picks` and `/quiz` freeze
      surfaces across en/es/fr/de.
