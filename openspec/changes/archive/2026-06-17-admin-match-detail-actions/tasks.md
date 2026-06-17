## 1. Server actions: detail wrappers & redirect retargeting

- [x] 1.1 In `actions.ts`, extract the shared fixture parse/validate/save logic out of `saveFixture` into a reusable helper (so both the create path and the new detail edit path use the same Zod schema, managed-competition scoping, and group-code rule).
- [x] 1.2 Add `saveFixtureDetail(formData)`: runs the shared save for an existing match, catches validation errors instead of throwing, and `redirect()`s to `/admin/matches/[id]?editResult=saved|invalid`. Keep bare `saveFixture` redirect-free for the list create form.
- [x] 1.3 Add `setMatchResultDetail(formData)`: runs `setMatchResult` core, then `redirect()`s to `/admin/matches/[id]?resultResult=saved` (catch + `invalid` on error).
- [x] 1.4 Add `forceRecomputeDetail(formData)`: runs `forceRecompute` core, then `redirect()`s to `/admin/matches/[id]?recomputeResult=recomputed`.
- [x] 1.5 Retarget `resendResultEmails` redirect from `/admin/matches?...` to `/admin/matches/[id]?...` (keep the `resendEmailed/Failed/Skipped` and `resendError=notFinal` params).
- [x] 1.6 Retarget `summarizeMatch` redirect from `/admin/matches?...` to `/admin/matches/[id]?summaryReason=...`.
- [x] 1.7 Make delete redirect to the list: add a detail-context delete (wrapper or branch) that runs `deleteMatch` core then `redirect()`s to `/admin/matches?deleteResult=deleted`, so the deleted detail page is never re-rendered.
- [x] 1.8 Confirm all wrappers stay `assertAdmin()`-gated and scoped via `assertMatchInManaged`, and that `revalidateAfterMutation` still covers the detail and list paths.

## 2. Detail page: action UI

- [x] 2.1 Add an **Edit fixture** form to `[matchId]/page.tsx` (stage select from managed format, group_code hidden when the format has no group stage, home_team, away_team, kickoff_at, venue) posting to `saveFixtureDetail`; prefill `kickoff_at` using the same UTC-wall-clock formatting the current list edit form uses.
- [x] 2.2 Add a **Result entry** form (home_score, away_score, status select) posting to `setMatchResultDetail`.
- [x] 2.3 Add a **maintenance** control group: Force recompute scores (`forceRecomputeDetail`), Resend result emails (rendered only when `status === "final"`, posting to `resendResultEmails`), and Delete fixture (confirm-gated, destructive, posting to the detail delete).
- [x] 2.4 Relocate the one-shot **Summarize** trigger to the recap section's empty state (shown when no version exists) posting to `summarizeMatch`; keep the existing Regenerate/publish/delete-draft tools.
- [x] 2.5 Lay the new controls out cleanly (mobile-first, accessible) within the existing detail layout; reuse `Card`/`FormSection`/`SubmitButton` and ensure destructive actions are clearly separated.

## 3. Detail page: inline outcomes

- [x] 3.1 Extend `pickOutcome` to read the new query keys (`editResult`, `resultResult`, `recomputeResult`, `summaryReason`, and the `resend*` set) in addition to the existing recap keys.
- [x] 3.2 Extend the `OUTCOME` map with entries for: fixture saved, edit invalid, result saved, scores recomputed, fixture deleted, and the relocated summarize reasons; format the resend `emailed/failed/skipped` summary into its message.
- [x] 3.3 Surface the resolved outcome via the existing `ActionStatus` + `LiveRegion`, preserving success/error/info variants and the announce-vs-alert split.

## 4. List page simplification

- [x] 4.1 In `app/[locale]/(admin)/admin/matches/page.tsx`, remove from each row: the inline result form, the `<details>` Edit fixture form, and the maintenance button strip (force recompute, resend, summarize, delete).
- [x] 4.2 Keep each row as display only — teams, score, status, stage, kickoff — plus the Unconfirmed and Stale indicators and a single **Open** link to the detail page.
- [x] 4.3 Keep the page-level controls (managed-competition context, New fixture create form, Sync results now).
- [x] 4.4 Remove now-unused imports/components from the list page and stop parsing the query params that only the relocated controls produced.

## 5. i18n

- [x] 5.1 Add the new `admin.detail.*` outcome keys (editSaved, editInvalid, resultSaved, recomputed, fixtureDeleted, resend summary/notFinal, and any summarize labels) and the moved control labels to `messages/en.json`.
- [x] 5.2 Mirror the same keys in `messages/es.json`, `messages/fr.json`, and `messages/de.json` with correct translations.
- [x] 5.3 Remove `admin.*` keys that become unused once the list row is simplified — only after confirming they are not referenced elsewhere.

## 6. Verification

- [x] 6.1 Run typecheck, lint, and build; resolve any dead-import or missing-key errors.
- [ ] 6.2 Manually verify on the detail page: edit saves and shows inline outcome; result entry recomputes and shows outcome; force recompute, resend (final only), and summarize show outcomes; delete redirects to the list with a deleted outcome.
- [ ] 6.3 Verify the list shows only display + indicators + Open, and that New fixture and Sync results now still work.
- [x] 6.4 Verify managed-competition scoping and admin gating still reject out-of-scope and non-admin requests from the detail-page controls. (By inspection: every detail wrapper delegates to a core action that calls `assertAdmin()` + `assertMatchInManaged()`; resend/summarize unchanged.)
- [ ] 6.5 Spot-check all four locales (en/es/fr/de) render the new labels and outcomes.
