## Context

The `match-ai-summary` feature (just shipped) generates one recap per match,
driven only by the cron `sync_matches` pass via `generatePendingSummaries`. The
generator `generateMatchSummary(admin, matchId)` already gates on key →
exists → missing → not-final and is idempotent (unique `match_id` + `23505`
treated as "exists"). It does **not** check for event data: a `final` match with
zero `match_events` is summarized from the score alone.

Admins manage matches in `app/[locale]/(admin)/admin/matches/page.tsx`. Each
match row has a Manage block with a result form plus an action-button row
(`forceRecompute`, `ResendResultEmailsButton` shown only when `status==='final'`,
`deleteMatch`). Admin mutations are Server Actions in `.../matches/actions.ts`
that call `assertAdmin()`, resolve the managed competition, guard with
`assertMatchInManaged()`, mutate via the service-role admin client, then
`revalidateAfterMutation()` and `redirect()` with the outcome in query params,
which the page parses and renders through `<ActionStatus>`. Buttons use
`<SubmitButton>` (`useFormStatus` pending state, optional `confirmText`).

This change adds a manual, per-match trigger for that generator and makes
"there must be event data" an authoritative precondition.

## Goals / Non-Goals

**Goals:**
- One-click admin **Summarize** control on the managed match, with fast inline
  feedback covering every outcome.
- Only summarize when the match has real `match_events` — enforced in the
  generator so it holds for both the manual and cron paths.
- Reuse the existing admin action / button / action-status patterns; no new
  architectural surface, no schema change.

**Non-Goals:**
- Regenerating or overwriting an existing recap (still one-shot per match).
- Recording the manual trigger in operations-monitoring (`OperationKind` stays
  the fixed `sync_matches | sync_news | prediction_reminders | quiz_reminders`).
- Changing the recap content, model, prompt, or locale (still English).
- Editing the recap by hand.

## Decisions

### 1. Event-data validation lives in `generateMatchSummary`, not only the action
Add a `no-events` skip reason: after the not-final check and before the
OpenRouter call, count `match_events` for the match (`head: true, count: 'exact'`)
and return `{ generated: false, reason: 'no-events' }` when zero. The admin
action simply surfaces that reason.

- **Why**: the request is "summarize only when event data exists." Putting the
  gate in the single generator makes it true everywhere (manual *and* cron),
  avoids duplicated logic, and keeps the action thin. A recap from an empty
  timeline is low value, so the cron pass skipping such matches is an improvement.
- **Alternative — gate only in the admin action**: leaves the cron path
  summarizing event-less finals (inconsistent), and duplicates the count query.
  Rejected.
- **Consequence**: the cron `generatePendingSummaries` now counts event-less
  finals as `skipped`. The existing unit test that drove a success/`23505` path
  with `events: []` must switch to a non-empty events array.

### 2. Per-match Server Action, mirroring the resend-emails path
Add `summarizeMatch(formData)` to `.../matches/actions.ts`: `assertAdmin()` →
resolve managed competition → `assertMatchInManaged(matchId)` →
`generateMatchSummary(admin, matchId)` → `revalidateAfterMutation()` →
`redirect()` to the matches page with `summaryMatchId` + `summaryReason`
(`generated` when `generated === true`, else the skip reason; `error` on throw,
caught so the action never 500s the admin page).

- **Why**: identical shape to `resendResultEmails` / `saveFixture`; admins get
  the same mental model and the page's existing query-param → `ActionStatus`
  plumbing is reused.
- **Alternative — Route Handler + client fetch**: more moving parts, no benefit
  over a Server Action here. Rejected.

### 3. Button visibility driven by two batch precondition queries
On the matches page (already server-rendered with the visible matches), run two
queries scoped to the visible match ids: (a) `match_summaries` rows that exist
(`select match_id in (...)`), and (b) `match_events` presence
(`select match_id in (...)`, deduped to a Set). Render per match:
- `final` + has events + no summary → **Summarize** button.
- `final` + has summary → small "Recap ready" indicator (no button).
- `final` + no events → disabled button with a "no events yet" hint.
- not `final` → nothing (same as resend-emails).

- **Why**: two index-backed queries over the already-bounded visible id list are
  cheap (`match_events` is indexed on `(match_id, sequence)`; `match_summaries`
  is unique on `match_id`) and give correct affordances without an N+1.
- **Alternative — always show the button, validate only on click**: simpler page,
  worse UX (admin clicks then learns "no events"). The server action still
  validates authoritatively regardless, so this is purely about affordance.
  Rejected for the default state; the action remains the source of truth.

### 4. No new `OperationKind` for the manual trigger
The per-match action does not call `recordRun`. Consistent with the prior
`match-ai-summary` change, which deliberately did not add a `generate_summaries`
kind (the union is fixed by a DB CHECK + dashboard i18n labels). A single manual
summarization is lightweight; its outcome is shown inline, not in the run log.

### 5. Outcome strings are localized; recap stays English
Add `messages/{en,es,fr}.json` keys for the button label, pending label, the
"recap ready" indicator, the "no events" hint, and one message per outcome
(`generated`, `exists`, `no-events`, `not-final`, `no-key`, `error`). The recap
body itself remains English (`locale='en'`) — only the admin chrome is localized.
i18n parity is enforced by `tests/i18n.test.ts`.

## Risks / Trade-offs

- **Cron behavior shifts: event-less finals stop being summarized** → Intended.
  Such recaps are low value; they are now counted as `skipped`, not lost data.
- **Existing zero-events unit test breaks under the new gate** → Update that test
  to pass real events; add explicit `no-events` coverage.
- **Two extra page queries per matches render** → Scoped to the visible match ids
  and index-backed; negligible. No per-row queries.
- **Admin clicks while cron is generating the same recap** → The unique
  constraint plus the existing `23505 → exists` handling makes the manual path
  idempotent; the admin sees "already exists".
- **`OPENROUTER_API_KEY` unset in the environment** → Action returns `no-key`;
  the button surfaces a "generator disabled" message rather than failing.

## Migration Plan

- No database migration. Pure application change.
- Ship behind the existing env gate: with `OPENROUTER_API_KEY` unset the button
  reports `no-key` and writes nothing.
- Rollback: revert the PR. No data shape changes to undo (no rows are created
  that the prior code can't read).
