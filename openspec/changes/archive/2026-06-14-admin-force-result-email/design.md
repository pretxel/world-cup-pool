## Context

`dispatchResultEmails(fromName?)` in `lib/notifications/result-emails.ts` is the only sender. It loads every scored row on `final` matches, subtracts the `result_email_log` ledger via `computePendingByUser`, renders per recipient, sends in ≤100 batches through Resend, and stamps the ledger only for accepted batches. The cron route (`app/api/cron/sync-matches`) calls it after recomputing scores. The ledger gives at-most-once delivery and is backfilled at migration time so deploys never blast history.

The admin matches surface (`app/[locale]/(admin)/admin/matches/`) already exposes match-scoped maintenance actions — `forceRecompute`, `syncNow`, `setMatchResult`, `deleteMatch` — as `assertAdmin()`-gated server actions that mutate via the service-role admin client and are scoped to the managed competition through `assertMatchInManaged`. A force-resend control belongs in exactly this row of controls.

The gap: once a `(match, user)` row exists in the ledger, the cron path suppresses it forever. There is no supported way to re-send after a bad template, a silent batch failure, or a corrected scoreline. The only current escape hatch is hand-editing the ledger.

## Goals / Non-Goals

**Goals:**
- An admin can re-send result emails for one `final` match on demand, regardless of ledger state.
- Force-send reuses the existing resolve → render → send → ledger pipeline (no second renderer, no second batching path).
- Force-send is scoped to the target match only and gated to admins of the managed competition.
- Env-gating, batching, and the `{ emailed, failed, skipped }` summary are preserved and surfaced back to the admin.

**Non-Goals:**
- No bulk / all-matches force-send button (cron already covers the steady state; force is a targeted repair tool).
- No per-recipient force (whole-match scope only).
- No schema change, no new ledger columns, no "force history" audit table.
- No change to cron behavior or at-most-once semantics for the automated path.

## Decisions

### Decision: Extract a shared core; force is the same pipeline with the ledger filter swapped

Refactor the body of `dispatchResultEmails` so the recipient-build → resolve-email → render → batch-send → stamp-ledger steps live in one internal function parameterized by **which scored rows are pending**. The cron path passes the ledger (subtract sent pairs); the force path passes an **empty ledger for the target match** so every scored recipient of that match is pending.

- `dispatchResultEmails(fromName?)` keeps its signature and behavior (loads all final scores + full ledger).
- New `forceDispatchResultEmails(matchId, fromName?)`: loads scored rows for **that match only**, computes pending with the ledger treated as empty for that match (always re-send), then runs the identical send/stamp tail.

Alternative considered — a `force: boolean` flag threaded into `dispatchResultEmails` that skips the ledger query globally. Rejected: it makes the dangerous all-matches blast reachable from one boolean and muddies the cron path's invariant. A separate, match-scoped entry point keeps the blast radius structurally bounded.

### Decision: Match scope enforced at the query, not just the prompt

`forceDispatchResultEmails` filters `scores` by `match_id` in the SQL select (`.eq("match_id", matchId)` alongside `matches.status = 'final'`). Scope is a data boundary, not a UI affordance — even a malformed call cannot widen beyond the one match.

### Decision: Re-stamp the ledger after a successful force-send

The force path still upserts `result_email_log` rows for the sent pairs (`onConflict: match_id,user_id, ignoreDuplicates: true`). Rows already present stay; `sent_at` is not rewritten. This keeps the ledger meaning "this pair has been emailed at least once" and prevents the next cron run from re-sending what the admin just sent.

### Decision: Reject non-final matches before sending

The server action validates the target is `final` (mirrors the recipients-are-final invariant) and returns a readable error otherwise, rather than silently producing zero recipients. The UI only renders the button for `final` matches; the action re-checks server-side.

### Decision: Surface the summary to the admin

The `resendResultEmails` server action returns/toasts the `{ emailed, failed, skipped }` summary so the admin sees "emailed 7, skipped 1" rather than a blind success. `skipped` (no resolvable email) and `failed` (Resend rejected) stay distinct, matching the cron summary.

## Risks / Trade-offs

- **Duplicate inboxes** — force intentionally re-sends to players who already got the email. → Acceptable and is the whole point; mitigated by single-match scope and the confirm step in the UI, plus the admin-only gate.
- **Admin clicks repeatedly / double-submit** → each click is a real re-send. → Disable the button while pending and require a confirm; scope caps the cost at one match's recipients.
- **Resend rate/cost from manual triggers** → bounded by single-match scope (≤ one match's predictors) and ≤100 batching; no all-matches path exists.
- **Refactor regresses the cron path** → the shared-core extraction is covered by the existing `tests/result-emails.test.ts`; force-path cases are added so both callers are pinned.
- **`RESEND_API_KEY` unset in an env where an admin clicks** → force-send no-ops and returns a zero summary (same as cron); the toast says "0 emailed" rather than erroring.

## Migration Plan

Pure code change, no DB migration. Deploy ships the refactor + new action + button together. Rollback = revert the commit; the ledger and cron path are untouched by a revert because the refactor preserves `dispatchResultEmails` behavior and writes no new schema.

## Open Questions

- Confirm copy/UX: inline confirm vs. a dialog for "Resend to N players?" — defaulting to a lightweight confirm with the recipient count, resolvable during implementation against the existing admin matches UI.
