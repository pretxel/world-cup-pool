## 1. Generator: require event data

- [x] 1.1 Add `"no-events"` to the `GenerateResult` reason union in `lib/matches/match-summary.ts`
- [x] 1.2 In `generateMatchSummary`, after the not-final check and before the OpenRouter call, count `match_events` for the match (`select("*", { count: "exact", head: true }).eq("match_id", matchId)`) and return `{ generated: false, reason: "no-events" }` when the count is zero (no LLM call, no insert)
- [x] 1.3 Confirm `generatePendingSummaries` treats a `no-events` result as `skipped` (no code change if it already buckets non-generated results as skipped; otherwise adjust)

## 2. Admin Server Action

- [x] 2.1 Add `summarizeMatch(formData)` to `app/[locale]/(admin)/admin/matches/actions.ts`: `assertAdmin()`, resolve managed competition, read `match_id` (+ `locale`) from FormData, `assertMatchInManaged(matchId)`
- [x] 2.2 Call `generateMatchSummary(createAdminSupabaseClient(), matchId)`; wrap in try/catch so a thrown error maps to an `error` outcome instead of a server-error page
- [x] 2.3 `revalidateAfterMutation(...)` then `redirect()` back to the matches view with `summaryMatchId` and `summaryReason` (value `generated` when `generated === true`, else the skip reason, or `error` on throw)

## 3. Management view UI

- [x] 3.1 In `app/[locale]/(admin)/admin/matches/page.tsx`, fetch two batch preconditions scoped to the visible match ids: the set of `match_id`s that already have a `match_summaries` row, and the set of `match_id`s that have at least one `match_event`
- [x] 3.2 Create a `<SummarizeMatchButton>` client component mirroring `components/admin/resend-emails-button.tsx` (`<form action={summarizeMatch}>`, hidden `match_id` + `locale`, `<SubmitButton>` with pending label)
- [x] 3.3 Render per `final` match in the action-button row: Summarize button when events exist and no summary; a "recap ready" indicator when a summary exists; a disabled button + "no events yet" hint when no events exist; nothing when not `final`
- [x] 3.4 Parse `summaryMatchId` / `summaryReason` from query params and render the matching `<ActionStatus>` (success for `generated`; info/neutral for `exists`, `no-events`, `not-final`, `no-key`; error for `error`) under the affected match

## 4. Localization

- [x] 4.1 Add admin-matches keys to `messages/en.json`: button label, pending label, "recap ready" indicator, "no events yet" hint, and one message per outcome (`generated`, `exists`, `no-events`, `not-final`, `no-key`, `error`)
- [x] 4.2 Mirror the same keys in `messages/es.json` and `messages/fr.json` (Spanish + French) so locale parity holds

## 5. Tests & verification

- [x] 5.1 Extend `tests/match-summary.test.ts`: add a case asserting `generateMatchSummary` returns `{ generated: false, reason: "no-events" }` for a final match with zero events (no LLM call, no insert); update the existing zero-events unique-violation/success cases to pass a non-empty events array
- [x] 5.2 Add a test for `summarizeMatch`: rejects when not admin / match not in managed competition; surfaces `no-events`, `generated`, and `error` outcomes via the redirect params (mock `generateMatchSummary`)
- [x] 5.3 Run `npm run lint`, `npm run typecheck`, `npm run test` (i18n parity test must pass)
