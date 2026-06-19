# Tasks — Rank-change notification

## 1. Database snapshot table

- [x] 1.1 Create a timestamped migration under `supabase/migrations/`
      (e.g. `<UTCstamp>_leaderboard_rank_snapshot.sql`) adding table
      `leaderboard_rank_snapshot (competition_id uuid, user_id uuid, rank int,
      captured_at timestamptz default now(), primary key (competition_id, user_id))`
      with FKs to `competitions` and `profiles` (on delete cascade).
- [x] 1.2 Enable RLS with no policies (service-role-only), mirroring
      `result_email_log`; add a header comment documenting the "rank as of the
      previous run" semantics and that it is purely additive (no backfill).

## 2. Snapshot capture in the sync cron

- [x] 2.1 Add a snapshot helper (e.g. `lib/notifications/rank-snapshot.ts`) that
      upserts `select user_id, rank, active_competition_id()` from
      `v_leaderboard_overall` into `leaderboard_rank_snapshot`
      (on conflict `(competition_id, user_id)` update `rank`, `captured_at`).
- [x] 2.2 In `app/api/cron/sync-matches/route.ts`, call the snapshot helper
      BEFORE `runSync()`, isolated in try/catch and logged, so a failure never
      aborts the run; add a comment that ordering before recompute is required.

## 3. Rank-delta computation in dispatch

- [x] 3.1 In `lib/notifications/result-emails.ts`, add a pure `computeRankDelta`
      (previousRank, newRank) → `{ direction: 'up'|'down'|'same'|'new',
      magnitude, previousRank? }`, exported for unit testing.
- [x] 3.2 In `dispatchPending`, load `leaderboard_rank_snapshot` rows for the
      affected user ids and compute each player's delta from the snapshot rank
      and the `rank` already read from `v_leaderboard_overall`.
- [x] 3.3 Thread the delta into `ResultEmailData` (new optional `rankDelta`);
      pass `null` from `forceDispatchResultEmails`.

## 4. Email template rendering

- [x] 4.1 Add a `RankDelta` type and an optional `rankDelta` field to
      `ResultEmailData` in `lib/notifications/result-email-template.ts`.
- [x] 4.2 Render the localized delta line in the standing section (HTML) and
      mirror it in `renderText`; render the neutral variant for `same`/`new`/null.
- [x] 4.3 Add the resolved delta strings to `buildResultEmailStrings` /
      `ResultEmailStrings` so copy stays caller-resolved (no next-intl in the
      template).

## 5. i18n

- [x] 5.1 Add a `rankDelta` ICU `select` message (on direction `up`/`down`/
      `same`/`new`, with `{count}` and `{rank}`) and any label keys to the
      `email` namespace in `messages/en.json`.
- [x] 5.2 Mirror the same keys in `messages/es.json`, `messages/fr.json`, and
      `messages/de.json`.

## 6. Verification

- [x] 6.1 Add unit tests for `computeRankDelta` (up / down / same / new) and for
      the template rendering each variant (HTML + text).
- [x] 6.2 Typecheck, lint, and run the test suite; confirm existing
      result-email tests still pass.
- [ ] 6.3 Manual check: run the sync-matches cron locally twice (snapshot →
      finalize a match → dispatch) and confirm the result email shows the
      correct "moved up/down N to #X" line; verify admin force-resend renders the
      neutral variant. (Not run — no local Supabase stack / live DB available in
      this environment; covered indirectly by the unit tests for computeRankDelta,
      template variants, and dispatch snapshot read.)
- [x] 6.4 Run `openspec validate "rank-change-notification"` and confirm it passes.
