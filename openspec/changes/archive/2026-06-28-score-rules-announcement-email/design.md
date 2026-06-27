## Context

Stage-weighted scoring (`stage-weighted-scoring`) multiplies base accuracy points by a per-stage factor. The shared constants `BASE_POINTS` and `STAGE_POINT_MULTIPLIER` in `lib/scoring.ts` are the single source; the landing-page `components/scoring-explainer.tsx` already renders a per-phase table from them.

The product has a mature broadcast-email pattern. `lib/notifications/playoff-score-emails.ts` + `playoff-score-template.ts` show the canonical shape: a pure renderer fed already-localized strings; a dispatcher that pages all `profiles`, resolves addresses via the service-role admin client, applies opt-out (`isOptedIn`), guards the production sender (`checkEmailSenderConfig`), sends in Resend batches of ≤100, and writes an idempotency ledger only for accepted batches. The operations control room (`admin-operations-monitoring`) triggers these via `recordRun(kind, "manual", JOB[kind])`, renders one tile per `OperationKind` with last/next run and a "Run now" button, and shows the returned summary inline. Every tile currently calls `nextScheduledRun(kind)`, and `OPERATION_SCHEDULES` is an exhaustive `Record<OperationKind, …>` — so a job is assumed to have a cron.

## Goals / Non-Goals

**Goals:**
- One admin click sends the new-scoring announcement to all opted-in players.
- Idempotent: re-pressing "Run now" never re-emails a player who already got it.
- Email content derives from the shared scoring constants (no drift from the scorer).
- Maximum reuse of the existing dispatcher, sender-guard, and operations UI.

**Non-Goals:**
- No cron schedule — this is a one-off announcement, triggered manually.
- No change to the scorer, leaderboards, or other emails.
- No new user-facing opt-out category (reuse an existing preference key).
- Not necessarily multi-locale in the body — match the existing broadcast (default-locale) for v1.

## Decisions

### Decision: Surface it as a manual-only job in the operations control room
Add `score_rules_email` to `OperationKind` and wire a `runScoreRulesEmail` action + tile, reusing `recordRun`, the inline summary panel, and the admin assertion. This is where admins already trigger every dispatch, so it is the lowest-friction, most consistent home.

To support "no cron," relax the schedule model: `OPERATION_SCHEDULES` becomes a partial map (or `nextScheduledRun` returns `Date | null`), and the overview tile renders a "manual only" indication when there is no next run. This is the one modification to `admin-operations-monitoring`.

*Alternative considered:* a standalone button on the competitions/announcements page outside the cron grid. Rejected — it duplicates the run/record/summary UI and splits "where admins send emails" across two places. The manual-only tile is a small, contained change.

### Decision: Send-once idempotency via a dedicated ledger
New table `score_rules_email_log (user_id uuid pk, sent_at timestamptz default now())`, RLS service-role-only, mirroring `playoff_score_email_log` but **without a date column** — the announcement is one-off, so the key is the user alone. Pending = all profiles minus rows already in the ledger (minus opt-outs). Ledger rows are written only for Resend-accepted batches, so failures retry on the next "Run now."

*Alternative considered:* reuse `playoff_score_email_log` with a synthetic date. Rejected — overloads an unrelated ledger and muddies its semantics. A purpose-named table is clearer and matches the per-email-type ledger convention.

### Decision: Content derived from shared scoring constants
The template receives a precomputed per-phase rows array (stage label + multiplier + points per tier) built in the dispatcher from `BASE_POINTS` × `STAGE_POINT_MULTIPLIER`, exactly like `ScoringExplainer`. Stage labels come from the active competition format via `getStageLabel`. The renderer stays pure (no constants import) for unit testing.

*Alternative considered:* hardcode the points in copy. Rejected — guaranteed to drift the moment multipliers change; the spec for stage-weighted scoring explicitly requires derivation from the shared constants.

### Decision: Reuse the `results_digest` opt-out key
Gate recipients on `isOptedIn(prefs, "results_digest")`, as `playoff-score` does, so no new opt-out category or account-menu toggle is needed. A product announcement about scoring fits the "general updates" family.

*Alternative considered:* a new `score_rules` pref key, or send to everyone ignoring prefs. Rejected for v1 — a new key means UI + schema churn for a one-off; ignoring prefs disrespects opt-out. (See Open Questions.)

### Decision: Mirror the playoff-score dispatcher mechanics
Paged `profiles` scan, service-role `getUserById` address resolution, `isSendableEmail` filter, `checkEmailSenderConfig` warning surfaced via a `senderMisconfigured` summary flag, Resend `batch.send` in chunks of ≤100, `DispatchSummary { emailed, failed, skipped }`. No-ops cleanly when `RESEND_API_KEY` is unset or there are no pending recipients.

## Risks / Trade-offs

- **Accidental re-send to everyone** → the send-once ledger makes re-pressing "Run now" safe; only never-sent, opted-in users receive it.
- **Manual-only job breaks the exhaustive schedule `Record`** → change the type deliberately and render a "manual only" tile; covered by the `admin-operations-monitoring` spec delta and a unit test for `nextScheduledRun` returning null.
- **Large recipient list / Resend limits** → batched ≤100 with per-batch failure isolation (failed batch stays pending, retries next run), same as existing broadcasts.
- **Default-locale-only body** → acceptable for a one-off announcement and consistent with `playoff-score`; per-locale send is a future enhancement.
- **Sender misconfigured in prod** → existing guard warns and flags the summary; dispatch still attempts with the resolved sender.

## Migration Plan

1. Add the `score_rules_email_log` table + RLS via a Supabase migration (mirror `playoff_score_email_log`).
2. Ship the template, dispatcher, operation kind, action, and tile.
3. Deploy. Admin presses "Run now" once to send; ledger guarantees one send per user. Rollback = revert the diff; the unused table can stay (harmless) or be dropped in a follow-up.

No backfill. No cron entry added to `vercel.json`.

## Open Questions

- Opt-out key: reuse `results_digest` (default), introduce a dedicated `score_rules` key, or treat the announcement as transactional and ignore prefs? (Default: reuse `results_digest`.)
- Locale: send in default locale only (default), or per-recipient locale if a stored locale is available?
- Should the tile be hidden once every player has been sent (ledger fully covers profiles), or always visible? (Default: always visible; it simply no-ops.)
