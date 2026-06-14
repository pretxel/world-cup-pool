## 1. Refactor dispatch into a shared core

- [x] 1.1 In `lib/notifications/result-emails.ts`, extract the resolve-email → render → batch-send → stamp-ledger tail of `dispatchResultEmails` into an internal function (e.g. `sendPrepared(admin, pending, fromName)`) that takes already-computed `PendingRecipient[]` and returns a `DispatchSummary`.
- [x] 1.2 Reshape `dispatchResultEmails(fromName?)` to load all final scores + the full ledger, compute pending via `computePendingByUser`, then call the shared tail — preserving its current behavior and signature.
- [x] 1.3 Keep `env.resendApiKey` no-op gating at the top of both public entry points so neither path queries or sends when the key is unset.

## 2. Add the force-dispatch entry point

- [x] 2.1 Add `forceDispatchResultEmails(matchId: string, fromName?: string): Promise<DispatchSummary>` that selects `scores` for `match_id = matchId` joined to `matches` with `status = 'final'` only (match scope enforced in SQL).
- [x] 2.2 Compute pending with the ledger treated as empty (pass `[]` to `computePendingByUser`) so every scored recipient of the match is pending regardless of `result_email_log`.
- [x] 2.3 Run the shared tail; confirm it upserts `result_email_log` with `onConflict: "match_id,user_id", ignoreDuplicates: true` so existing rows are preserved and the cron stays at-most-once afterward.
- [x] 2.4 Return `{ emailed, failed, skipped }`; no-op to a zero summary when `RESEND_API_KEY` is unset.

## 3. Admin server action

- [x] 3.1 In `app/[locale]/(admin)/admin/matches/actions.ts`, add `resendResultEmails(formData)` that reads `match_id`, runs `assertAdmin()` and `assertMatchInManaged(match_id)`.
- [x] 3.2 Load the match and reject with a readable error if its status is not `final` before dispatching.
- [x] 3.3 Call `forceDispatchResultEmails(match_id)` and return/propagate the `{ emailed, failed, skipped }` summary to the caller.
- [x] 3.4 Revalidate `/admin/matches` after the action (no public surface changes).

## 4. Admin UI

- [x] 4.1 In the `/admin/matches` match row component, render a Resend result emails control only when the match status is `final`, beside the existing recompute/sync controls.
- [x] 4.2 Wire the control to `resendResultEmails`, disable it while pending, and require a lightweight confirm showing the recipient scope ("Resend to this match's players?").
- [x] 4.3 Surface the returned summary via a toast (emailed / failed / skipped); show a clear message for the zero-summary no-op case.
- [x] 4.4 Add button + toast copy to the admin/email i18n namespaces in `messages/*` for all supported locales.

## 5. Tests

- [x] 5.1 Extend `tests/result-emails.test.ts`: `forceDispatchResultEmails` re-emails pairs that already have ledger rows (ledger ignored for the target match).
- [x] 5.2 Test force scope: only the target `match_id`'s scored players are emailed when other final matches have recipients.
- [x] 5.3 Test force re-stamps the ledger (upsert ignore-duplicates) and a subsequent cron `dispatchResultEmails` does not re-email those pairs.
- [x] 5.4 Test env-gating (no `RESEND_API_KEY` → zero summary, no writes), ≤100 batching, and unresolvable-email → `skipped` not `failed` on the force path.
- [x] 5.5 Test the `resendResultEmails` action rejects non-admins, out-of-managed-competition matches, and non-`final` matches without sending.

## 6. Verify

- [x] 6.1 Run `pnpm test` and `pnpm run build`; confirm both pass.
- [x] 6.2 Run `openspec validate admin-force-result-email --strict` and resolve any issues.
