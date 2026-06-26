## Context

The product already has two mature result-email flows that share one set of primitives:

- `result-email-notifications` — transactional, per-match, sent to players who predicted a match when it finalizes.
- `daily-results-digest-email` — a once-daily broadcast to all opted-in players (`app/api/cron/results-digest/route.ts` → `dispatchResultsDigest` → `results-digest-template.ts`).

Both build on: a Vercel cron route gated by `CRON_SECRET`, `recordRun(kind, "cron", …)` instrumentation, a pure localized renderer returning `{ subject, html, text }`, a dispatcher that resolves recipients + sends via Resend in ≤100-message batches, `isOptedIn` opt-in gating, the `checkEmailSenderConfig` production guard, and a per-period dedupe ledger with RLS-no-policies (service-role-only) plus a creation-time backfill.

This change adds a third flow in the same shape but with a distinct cadence and selection: a **Saturday-only** broadcast of just the **final scorelines of that day's knockout matches**. Knockout matches are identified by `matches.stage` (`MatchStage = "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final"`); "playoff" = any stage other than `group`. The day's finished playoff matches are those for the active competition with `status = 'final'`, a non-`group` stage, and a kickoff within the target Saturday.

## Goals / Non-Goals

**Goals:**
- Email all opted-in players, once on knockout Saturdays, the final scorelines of that Saturday's finished playoff matches.
- Reuse the existing cron + renderer + dispatcher + Resend + i18n + `recordRun` + dedupe-ledger pattern with zero new third-party dependencies.
- Send nothing (clean skip) when the target Saturday has no finished playoff matches, and never double-send on a same-day re-run.

**Non-Goals:**
- No per-player points, hit types, rank, rank delta, biggest movers, or bracket/advancement sections — body is **scorelines only**. (These already live in other emails and can be added later.)
- No new user-facing email-preference category; gating uses the existing general email opt-in.
- No change to how matches, stages, scores, or the bracket are computed.

## Decisions

### D1: Weekly Saturday cron, not daily with a weekday guard
A dedicated `crons` entry scheduled only on Saturday (`* * * * 6` form, fixed UTC hour after `sync-matches`'s `0 9 * * *`, e.g. `0 11 * * 6`). The route still re-checks "is this run's date a Saturday" defensively, but scheduling on Saturday keeps invocation cost near zero the other six days.
- *Alternative:* daily cron that no-ops Mon–Fri — wastes six invocations/week and muddies logs. Rejected.
- *Alternative:* reuse the daily `results-digest` cron and branch on Saturday+playoff — couples two cadences and risks regressions in the daily digest. Rejected.

### D2: "Playoff match" = non-`group` stage on the active competition, `final`, kicked off that Saturday
Selection filters `matches` by active competition, `stage <> 'group'`, `status = 'final'`, and kickoff within the Saturday window. The Saturday window is computed from the run date in the competition's reference timezone (same approach the digest/reminder flows use), not naive UTC midnight, so late-night kickoffs land on the right day.
- *Alternative:* a `kind: 'knockout'` lookup via `format_config.stages` — more correct in theory but heavier; the `stage <> 'group'` predicate is sufficient for the current single-competition format and matches the `leaderboard_for_stage` precedent. Documented as a refinement if multi-format competitions diverge.

### D3: Scoreline-only renderer
`lib/notifications/playoff-score-template.ts` is pure and dependency-free, mirroring `results-digest-template.ts`: email-safe table layout, inline styles, fixed hex colors (no `oklch`/`var()`/stylesheets), HTML-escaping all interpolation, and a plain-text part. It receives a list of finished matches (`{ home, away, homeScore, awayScore, resultNote? }`) plus resolved copy; it hardcodes no strings. `resultNote` carries a knockout decider hint (e.g. "AET", "pens") when present. One CTA deep-links to `/bracket` (built from `env.siteUrl` + `localePath(DEFAULT_LOCALE, "/bracket")`).

### D4: Recipients = all opted-in players (digest model)
Resolve every player with a usable email who is `isOptedIn`, exactly like `dispatchResultsDigest`. Not restricted to predictors — this is a broadcast.

### D5: Per-Saturday dedupe ledger `playoff_score_email_log`
Primary key `(digest_date, user_id)`; RLS enabled with no policies (service-role only); a ledger row is written only **after** Resend accepts the batch containing that recipient, so failures stay pending and retry on a same-day re-run. The creation migration backfills the current day's ledger for all players so first deploy doesn't email a Saturday already in progress (mirrors `results_digest_log`).

### D6: i18n namespace `playoffScoreEmail`
All copy resolved via `getTranslations({ locale: DEFAULT_LOCALE, namespace: "playoffScoreEmail" })`, present in `messages/{en,es,fr,de}.json`. Default-locale send, matching the other broadcast emails.

### D7: Route safety mirrors `results-digest/route.ts`
Bearer `CRON_SECRET` auth (401 on mismatch; allow in non-prod when unset; skip in prod when unset). Dispatch wrapped in `recordRun("playoff_score_email", "cron", …)`, failures caught and surfaced as a zero summary (never a 500), `maxDuration` raised for address resolution + batching, returns the `{ emailed, failed, skipped }` summary as JSON.

## Risks / Trade-offs

- **`stage <> 'group'` misclassifies a non-knockout non-group stage** (e.g. a future third-place-only or repechage format) → Mitigation: current competition's only non-group stages are knockout rounds; if a format diverges, switch selection to `format_config.stages[].kind = 'knockout'`. Noted in D2.
- **Saturday window vs. timezone** → Mitigation: compute the window in the competition reference timezone like existing time-triggered flows; cover with a dedicated test.
- **Empty knockout Saturday still invokes the cron** → Mitigation: selection returns zero matches → dispatcher sends nothing and records a zero-summary run; no email, no ledger writes.
- **Broadcast volume** (all opted-in players) → Mitigation: Resend ≤100/batch chunking already implemented in the digest dispatcher; reuse it and raise `maxDuration`.
- **Overlap fatigue with the daily results digest** → Trade-off accepted: scope says scorelines-only and Saturday-only; content is deliberately distinct (knockout scores) and weekly, limiting redundancy.

## Migration Plan

1. Add migration creating `playoff_score_email_log` (`(digest_date, user_id)` PK, RLS enabled, no policies) + backfill current day for all players.
2. Ship renderer, dispatcher, and cron route.
3. Add `playoffScoreEmail` copy to all four locale files.
4. Register the Saturday cron in `vercel.json`.
5. **Rollback:** remove the `vercel.json` cron entry (stops all sends immediately); the table and code are inert without the schedule and can be dropped later.

## Open Questions

- Exact Saturday UTC hour — pick one comfortably after `sync-matches` (`0 9 * * *`) and after most Saturday knockout kickoffs finalize; default proposal `0 11 * * 6`, tunable in `vercel.json` without code change.
- Whether to also include the day's *next-round* fixture context later — deferred (Non-Goal here).
