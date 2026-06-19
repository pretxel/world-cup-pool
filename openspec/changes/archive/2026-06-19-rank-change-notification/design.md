# Design — Rank-change notification

## Context

The sync-matches cron (`app/api/cron/sync-matches/route.ts`) runs
`runSync()` — which recomputes `scores` for matches that just finalized — and
then calls `dispatchResultEmails()`. Inside dispatch
(`lib/notifications/result-emails.ts` → `dispatchPending`), one query reads
`v_leaderboard_overall` for the affected users to get their current `rank`,
`total_points`, etc., and the result-email template
(`lib/notifications/result-email-template.ts`) renders that standing.

Because scores are recomputed *before* dispatch, the `rank` read from the view is
already the **new** rank. The **previous** rank is not stored anywhere — once
`runSync()` writes new `scores`, the view reflects the new standing. So a delta
requires capturing rank *before* the recompute.

`v_leaderboard_overall` (from `20260614000200_leaderboard_competition_scope.sql`)
exposes `user_id` and `rank` (a `rank()` window over
`total_points desc, exact_hits desc, winner_gd_hits desc, first_submit asc`),
scoped to `active_competition_id()`. It already excludes admins
(`20260614040000`). Reading rank both pre- and post-recompute from the same view
keeps the delta self-consistent with what the leaderboard page shows.

## Goals / Non-Goals

**Goals:**
- Show "you moved up/down N to #X" in the result email after a match finalizes.
- Compute the delta from the same `v_leaderboard_overall` rank the email already
  displays, so the number is consistent with the leaderboard.
- Degrade gracefully: no snapshot (first appearance, admin force-resend) or
  unchanged rank renders a sensible line without breaking the email.
- Localize the new copy across en, es, fr, de.

**Non-Goals:**
- No in-app realtime rank-delta badge (that is análisis.md M2 realtime-leaderboard
  / the separate `RankBadge` work). An in-app indicator is explicitly optional in
  M3 and is left out to keep this change scoped to the email.
- No per-group or per-day rank delta — only the overall leaderboard
  (`v_leaderboard_overall`).
- No new cron schedule; this hangs off the existing sync-matches run.
- No change to scoring rules (`lib/scoring.ts` / `compute_match_scores`).

## Decisions

- **Persisted snapshot over transient compute.** A transient "before" value
  cannot exist by the time dispatch runs — `runSync()` has already mutated
  `scores`. So the cron writes a snapshot of every ranked player's current rank
  to a new `leaderboard_rank_snapshot` table *before* calling `runSync()`. The
  table is keyed `(competition_id, user_id)` and upserted each run, so it holds
  exactly "the rank as of the previous sync run" — which is the correct baseline
  for "since the last results came in".
- **Snapshot source = the view itself.** The snapshot step inserts
  `select user_id, rank, active_competition_id() from v_leaderboard_overall`
  (upsert on conflict). Using the view guarantees the same tie-break/exclusion
  rules as both the leaderboard and the post-recompute read.
- **Delta computed in dispatch, not in SQL.** `dispatchPending` already loads the
  board for affected users; add one query reading
  `leaderboard_rank_snapshot` for those same user ids and compute
  `previousRank`, `delta = previousRank - newRank` (positive = moved up), and a
  `direction` of `up | down | same | new`. `new` when there is no snapshot row.
- **Template gets a `RankDelta | null`.** `ResultEmailData` gains an optional
  `rankDelta`. The template renders a localized line under the standing block;
  `null`, `same`, or `new` render a neutral/celebratory variant rather than a
  numeric delta. The plain-text part mirrors it.
- **i18n via ICU select.** One `rankDelta` message keyed on direction
  (`up`/`down`/`same`/`new`) with `{count}` and `{rank}` placeholders, added to
  the `email` namespace in all four locales. Copy is resolved server-side with
  `getTranslations` exactly as the rest of the email already is (`DEFAULT_LOCALE`).
- **Admin force-resend renders no delta.** `forceDispatchResultEmails` passes
  `rankDelta = null` (there is no meaningful pre-state for an ad-hoc resend), so
  the line degrades to the neutral variant.

## Risks / Trade-offs

- **DB migration required.** New table `leaderboard_rank_snapshot`. Mitigation:
  purely additive, service-role-only (RLS enabled, no policies — same posture as
  `result_email_log` and `scores`); timestamped migration under
  `supabase/migrations/`.
- **Snapshot freshness window.** The baseline is "rank at the previous sync run",
  not "rank exactly before this match". Across a run where several matches
  finalize together the delta is the net move over that batch — acceptable and
  arguably more meaningful ("since last results"). Documented in the migration
  and the requirement.
- **First run after deploy** has an empty snapshot table, so the first batch of
  emails shows the `new` variant (no false "+0"). The next run onward has a
  baseline. The migration does not backfill, by design.
- **No new cron / no Supabase Realtime** needed — the snapshot write is one
  upsert inside the existing sync-matches handler, isolated and logged like the
  other post-sync steps so a failure never aborts the sync.
- **Ordering dependency.** The snapshot MUST run before `runSync()`; placing it
  after would capture the post-recompute rank and zero out every delta. Enforced
  by a unit-tested helper and a clear call-site comment.
