## Context

The `sync-matches` cron (`app/api/cron/sync-matches/route.ts` → `lib/result-sync/core.ts::runSync`) mirrors external results into `public.matches`. When a match flips to `final`, the run calls the `compute_match_scores(p_match_id)` RPC, which rewrites `public.scores` (one row per user per match: `points`, `hit_type`). The overall board is the view `v_leaderboard_overall` (`rank`, `total_points`, `exact_hits`, `winner_gd_hits`, `display_name`, `user_id`).

Player emails live only in `auth.users` — reachable through the service-role admin client (`lib/supabase/admin.ts`). `profiles` has `display_name` and `is_admin` but no email and no locale. There is no email infrastructure yet; `RESEND_API_KEY` is provisioned but unused. Env access is centralized in `lib/env.ts`, where cron-related vars are nullable and the route degrades to `204 x-skipped: missing-env` when they're absent.

The cron runs on a schedule (currently `0 9 * * *`). Each run can finalize zero or more matches; it can also re-run idempotently (the identical-final healing path re-invokes the RPC without a status change) and could crash mid-run. The design must send at most one standing email per player per finalized match across all of that.

## Goals / Non-Goals

**Goals:**
- Email each player whose standing changed (had a prediction scored on a newly-final match) a personal snapshot of their current standing plus the match(es) that triggered it.
- Visually match the web app (pitch-green/cream/gold palette, mono uppercase labels, ranking-card language) using email-safe HTML.
- At-most-once delivery per (match, player), resilient to idempotent re-runs and crashes; no blast of historical finals on first deploy.
- Never let email work fail or block the result sync.
- Reuse the existing scoring data (`scores`, `v_leaderboard_overall`) — no new scoring logic.

**Non-Goals:**
- Per-user locale (send in the default locale; `profiles` has no locale column).
- Opt-out / unsubscribe / List-Unsubscribe and email preferences.
- Digests, batching across multiple cron runs, or scheduling.
- Group/pool-scoped emails (snapshot is the global board only).
- A React Email / MJML build pipeline.

## Decisions

### D1 — Dispatch is a decoupled post-sync step keyed off a ledger, not off in-run transition flags
After `runSync()` returns, the route calls `dispatchResultEmails()`. That function does **not** rely on which matches `runSync` happened to flip this invocation. Instead it queries for **finalized matches that still have unsent recipients** by left-joining `scores` against the `result_email_log` ledger: a `(match_id, user_id)` is a pending recipient when `matches.status = 'final'` and no ledger row exists for that pair.

- *Why:* This is the only formulation that is simultaneously (a) at-most-once, (b) crash-recoverable (a run that finalizes then dies before sending leaves pending rows the next run picks up), and (c) immune to the idempotent-final healing path re-sending. Detecting "newly final this run" in-memory satisfies none of these — a crash after the status write but before send would drop the email forever, and it couples email to sync internals.
- *Alternative considered:* a `matches.results_emailed_at` timestamp. Rejected — it's per-match not per-(match,user), so a player who joins/predicts after the first send for that match could never be reached, and partial-failure recovery is impossible.

### D2 — Backfill the ledger for all existing finals in the creation migration
The migration that creates `result_email_log` immediately inserts a row for every `(match_id, user_id)` in `scores` whose match is already `final`. After backfill, the pending-recipient query returns empty for historical results, so deploying the feature emails nobody retroactively — only finals that happen after deploy produce sends.

- *Alternative considered:* a "feature start" cutoff timestamp compared against `scores.computed_at`. Rejected — `computed_at` moves on every idempotent recompute, so a healing re-run of an old match would look new. The ledger is unambiguous.

### D3 — Recipients = distinct users with a `scores` row for the finalized match; payload joins per-match outcome with the global snapshot
For each pending match, fetch its `scores` rows (`user_id`, `points`, `hit_type`) — these are exactly "players whose standing changed." For each such user, read their `v_leaderboard_overall` row for the global snapshot (rank, total points, exact/winner-GD hits) and their `auth.users` email. The email lists the finalized match(es) the player predicted (teams + final scoreline + the player's `points`/`hit_type` for it) and their current global standing. A player affected by two matches finalized in the same run gets **one** email covering both.

### D4 — Hand-rolled HTML/text renderer, email-safe, in `lib/notifications/result-email-template.ts`
A pure function `renderResultEmail(data) → { subject, html, text }`. Table-based layout, all styles inline, the oklch theme tokens converted to fixed hex for the light theme (email clients don't support oklch, CSS variables, or `@media` reliably):

| Token | App (oklch) | Email hex |
|---|---|---|
| background | `0.985 0.006 92` | `#FAF9F4` |
| card | `1 0 0` | `#FFFFFF` |
| foreground (ink) | `0.18 0.018 250` | `#1B2330` |
| muted-foreground | `0.48 0.018 250` | `#6B7280` |
| border | `0.9 0.012 92` | `#E5E2D7` |
| pitch (green) | `0.43 0.13 158` | `#1B7A4D` |
| pitch-foreground | `0.985 0.006 92` | `#FAF9F4` |
| flag (gold) | `0.82 0.17 82` | `#E7B53C` |
| flag-foreground | `0.24 0.05 60` | `#3A2E14` |
| live/destructive | `0.6 0.22 27` | `#D6402F` |

Visual structure mirrors the web: a pitch-green header band with the logotype, a finished-match card showing the scoreline and the player's outcome chip (exact = gold, winner/GD = green, miss = muted), then a standings card reusing the leaderboard `RankBadge` tones (rank 1 gold, 2 ink, 3 green) and the mono uppercase column labels (Rank / Player / Pts). Heading font uses a bold system sans stack (Bricolage won't load in mail); mono labels use a monospace stack with `letter-spacing`. A plain-text part mirrors the content for non-HTML clients. The renderer is pure → unit-testable with no DB or network.

### D5 — Resend SDK, batched, behind env gating that mirrors the cron
Add the `resend` package. `lib/env.ts` gains `resendApiKey = process.env.RESEND_API_KEY ?? null` and `emailFrom = process.env.EMAIL_FROM ?? "World Cup Pools <onboarding@resend.dev>"`. `dispatchResultEmails()` no-ops (logs + returns a zero summary) when `resendApiKey` is null, same spirit as the existing `missing-env` short-circuit. Sends use `resend.batch.send` chunked to 100 messages/call. A `(match_id, user_id)` is written to `result_email_log` **only after** its message is accepted by Resend, so failures stay pending and retry next run.

- *Alternative considered:* React Email for templating. Rejected — pulls in a renderer + build step for a single template; a pure string function is simpler and fully testable here.

### D6 — Failure isolation
`dispatchResultEmails()` is wrapped so any throw is caught and logged; the route returns the sync summary regardless. Per-recipient send errors are collected, logged, and counted; they do not abort the batch or the run. The route response JSON is extended with an `emailed` count (sent this run) for observability.

## Risks / Trade-offs

- **No per-user locale** → emails always render in the default locale even for ES/FR users. *Mitigation:* isolate copy in the `email` i18n namespace and read locale from a single resolver, so adding a `profiles.locale` column later is a one-line change. Documented as a known limitation.
- **`from` domain not yet verified in Resend** → sends may fail or land in spam until a domain is configured. *Mitigation:* `EMAIL_FROM` is env-driven and defaults to Resend's `onboarding@resend.dev` so dev works immediately; production sets a verified-domain sender. Failures are logged and retried (D1), not lost.
- **Backfill query scope** → a very large `scores` table makes the backfill insert heavy. *Mitigation:* one-time `INSERT … SELECT` in the migration; pool size is small (a friends pool), so this is negligible.
- **Crash between RPC write and send** → email is delayed, not dropped (next run's pending query catches it). *Trade-off accepted:* the delay is bounded by the cron interval.
- **Duplicate sends under concurrent runs** → two overlapping cron invocations could both pick the same pending pair. *Mitigation:* the unique `(match_id, user_id)` constraint makes the ledger insert the source of truth; on conflict the second insert is a no-op and that recipient is dropped from its batch. Crons are scheduled, not concurrent, so this is a backstop.
- **Email volume** → bounded by players × matches-finalized-per-run; a friends pool is tiny, well within Resend limits and the 100/batch chunking.

## Migration Plan

1. Add `resend` dependency; add `resendApiKey` + `emailFrom` to `lib/env.ts`.
2. Ship migration `*_result_email_log.sql`: create the table + unique constraint + RLS (service-role only), then backfill all current finals (D2). Regenerate `lib/database.types.ts`.
3. Land `result-email-template.ts` (pure renderer, fully unit-tested) and `result-emails.ts` (dispatch).
4. Wire `dispatchResultEmails()` into the cron route after `runSync()`, inside a catch (D6).
5. Add `email` i18n strings to `messages/{en,es,fr}.json`.
6. Verify `EMAIL_FROM` is set to a verified-domain sender in production env before relying on delivery.

**Rollback:** unset `RESEND_API_KEY` (or `EMAIL_FROM`) → dispatch no-ops, sync unaffected. The ledger table and migration are inert without the dispatch call. Full revert: remove the route wiring; the table can be dropped independently.

## Open Questions

- Production `EMAIL_FROM` sender / verified domain — needs a real address before launch (default is dev-only).
- Whether to surface a small "you've moved up/down N places" delta — would require persisting the prior rank; deferred unless wanted (current snapshot shows absolute standing only).
