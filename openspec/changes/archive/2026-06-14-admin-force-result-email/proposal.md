## Why

Result emails are sent at-most-once per `(match, player)` by the sync cron, and the `result_email_log` ledger permanently suppresses re-sends. When a send is wrong or missing — a bad template ships, a batch silently fails without a Resend error, a corrected scoreline changes standings, or a player reports a missing email — an admin currently has no way to re-send. Editing the ledger by hand is the only escape hatch. Admins need a first-class, scoped "resend result emails" control.

## What Changes

- Admin matches surface (`/admin/matches`) gains a per-final-match **Resend result emails** action that re-emails every scored player of that match, **bypassing the dedupe ledger**, then re-stamps the ledger.
- Extract the recipient-resolve → render → send → ledger core out of `dispatchResultEmails` so the cron path (ledger-respecting, all final matches) and the admin force path (ledger-bypassing, single match) share one implementation.
- Force-send is scoped to a single match and gated to admins of the managed competition; it never widens beyond that match's scored recipients.
- Force-send reuses Resend env-gating and batching: no-ops when `RESEND_API_KEY` is unset, batches at ≤100, and returns the same `{ emailed, failed, skipped }` summary surfaced back to the admin.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `result-email-notifications`: add an admin-initiated, match-scoped force-dispatch path that intentionally ignores the dedupe ledger for the target match and re-stamps it after a successful send, while preserving the cron path's at-most-once semantics for every other run.
- `admin-fixture-editing`: the `/admin/matches` per-match controls gain a Resend result emails action (alongside the existing recompute/sync controls), available only for `final` matches and reporting an emailed/failed/skipped summary.

## Impact

- Code: `lib/notifications/result-emails.ts` (refactor + new `forceDispatchResultEmails(matchId)` export); `app/[locale]/(admin)/admin/matches/actions.ts` (new `resendResultEmails` server action, `assertAdmin` + `assertMatchInManaged` gated); `app/[locale]/(admin)/admin/matches/page.tsx` and its match-row component (new button + result summary); `messages/*` admin/email namespaces (button + toast copy).
- Data: no schema change. Writes the existing `result_email_log` ledger via the service-role admin client.
- External: additional Resend `batch.send` calls on demand (admin-triggered, rate-limited by the single-match scope).
- Tests: `tests/result-emails.test.ts` extended for the force path (ledger ignored, re-stamped, env-gated, batched).
