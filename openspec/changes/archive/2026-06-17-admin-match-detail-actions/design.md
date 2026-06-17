## Context

`/admin/matches` (`app/[locale]/(admin)/admin/matches/page.tsx`) renders every fixture as a list row carrying three things: an inline result-entry form (`setMatchResult`), a collapsible **Edit fixture** form (`saveFixture`), and a strip of per-match maintenance buttons (`forceRecompute`, `resendResultEmails`, `summarizeMatch`, `deleteMatch`), on top of read-only display and Unconfirmed/Stale indicators. The row is dense and slow to scan.

A per-match detail page already exists at `app/[locale]/(admin)/admin/matches/[matchId]/page.tsx`. It renders read-only fixture info, the event timeline, and full recap-version management (regenerate draft / publish / delete-draft) using a query-param outcome pattern: actions `redirect()` back to the detail URL with an outcome code, the page maps it through an `OUTCOME` table to a localized `admin.detail.*` message, and renders it inline via `ActionStatus` + `LiveRegion`. All server actions live in one file (`actions.ts`), are `assertAdmin()`-gated, and scope to the managed competition via `assertMatchInManaged`.

This change relocates the editing and per-match maintenance UI from the list row onto the detail page, leaving the list as a read-only index. It is a UI move: server-action data contracts, validation, scoping, and the DB schema are untouched.

## Goals / Non-Goals

**Goals:**
- Make each `/admin/matches` row a clean index entry: display + Unconfirmed/Stale indicators + a single **Open** link.
- Give the detail page a focused per-match workspace: edit fixture, enter result, force recompute, resend emails (final only), delete fixture, plus the existing recap tools.
- Surface every detail-page action outcome inline and localized (en/es/fr/de), reusing the page's existing outcome pattern.
- Reuse the existing server actions and their managed-competition scoping with no contract change.

**Non-Goals:**
- No change to server-action validation logic, Supabase schema, scoring RPCs, or managed-competition scoping rules.
- No change to page-level list controls that are not per-match: managed-competition context, **New fixture** create form, **Sync results now**.
- No change to public-facing surfaces or to the recap versioning behavior itself.

## Decisions

### Decision: Reuse server actions; add thin detail-scoped wrappers only where redirect target differs

The moved controls keep calling the same core actions. The only behavioral mismatch is *where* an action sends the admin afterward:

- `saveFixture` is **shared** with the list's New-fixture create form, so it must stay redirect-free (the create path re-renders the list in place). For the detail **edit** path we need it to land back on the detail page with an inline outcome. Add a thin wrapper `saveFixtureDetail(formData)` that runs the same validated save, catches validation errors instead of throwing a server-error page, and `redirect()`s to `/admin/matches/[id]?editResult=saved|invalid`. The wrapper reuses the existing parse/scope logic (extract a shared helper rather than duplicating the Zod schema).
- `setMatchResult`, `forceRecompute`, `deleteMatch` currently revalidate and return (the list re-rendered in place). From the detail page they need to redirect back to the detail URL with an outcome — except **delete**, which must redirect to `/admin/matches` (the detail page ceases to exist). Add detail wrappers `setMatchResultDetail`, `forceRecomputeDetail`, and have delete redirect to the list (`?deleteResult=deleted`).
- `resendResultEmails` and `summarizeMatch` already redirect, but to the **list** (`/admin/matches?...`). Their only caller is the moved control, so retarget their redirect to the detail page (`/admin/matches/[id]?...`). No wrapper needed — change the redirect target in place.

**Alternative considered:** a single `source=detail|list` hidden field branching the redirect inside each action. Rejected: it overloads every action with view concerns and complicates the error-vs-throw behavior; thin wrappers keep the core actions pure and the view logic explicit.

**Alternative considered:** client-side `useActionState` + no redirect. Rejected: the detail page is a server component using the established redirect+query-param outcome pattern; matching it keeps one consistent mechanism and avoids converting the page to client state.

### Decision: Extend the existing detail-page outcome pipeline

Add the new outcome codes to the detail page's `OUTCOME` map and `pickOutcome` reader (new query keys: `editResult`, `resultResult`, `recomputeResult`, `resend*`, and the relocated `summaryReason`). Each maps to a new `admin.detail.*` message key. The resend summary (`emailed/failed/skipped`) is formatted into its message like the existing recap outcomes. One outcome renders per load, via the same `ActionStatus`/`LiveRegion` already on the page.

### Decision: List simplification keeps only non-per-match controls

Strip from each row: the result form, the `<details>` Edit fixture form, and the maintenance button strip. Keep: teams/score/status/stage/kickoff display, Unconfirmed and Stale indicators, and an **Open** link. Keep at page level: managed-competition context, New fixture form, Sync results now. Remove now-unused client-component imports from the list (e.g. result `SubmitButton`, summarize/resend buttons) and ensure they're imported on the detail page instead. The edit form's UTC-wall-clock `kickoff_at` prefill (used by the current list edit form so a `datetime-local` round-trips losslessly) moves verbatim to the detail edit form.

### Decision: i18n keys consolidate under `admin.detail.*`

The detail page already loads `getTranslations("admin")` and reads `detail.*`. Add the moved control labels and the new outcome messages as `admin.detail.*` keys across `messages/{en,es,fr,de}.json`. Reuse existing top-level `admin.*` field labels (`homeTeam`, `awayTeam`, `stage`, `venue`, `saveResult`, `deleteFixture`, `forceRecompute`, `resendEmails`, etc.) where they already exist; remove keys that become dead once the list row is simplified, only if unused elsewhere.

## Risks / Trade-offs

- **Delete must not re-render a deleted page** → the delete control on the detail page redirects to `/admin/matches?deleteResult=deleted`; the wrapper performs the redirect after a successful `deleteMatch`, so the now-missing detail route is never rendered.
- **Validation errors previously threw a server error on the list** → the detail wrappers catch validation failures and render an inline `invalid` outcome instead. This is a deliberate UX improvement; the create-on-list path keeps its existing throw behavior because it still calls bare `saveFixture`.
- **Kickoff timezone drift** → reuse the exact UTC-wall-clock prefill the list edit form uses; the `kickoffField` transform in `actions.ts` already parses zone-less `datetime-local` input as UTC, so the round-trip is unchanged.
- **Retargeting `resendResultEmails`/`summarizeMatch` redirects** → the list no longer parses their query params; confirm no other caller depends on the list-targeted redirect (only the moved per-match controls call them).
- **Dead i18n keys / dead imports** → removing list-row controls can orphan translation keys and component imports; verify with a build/lint pass and only delete keys confirmed unused.

## Migration Plan

1. Add detail wrappers (`saveFixtureDetail`, `setMatchResultDetail`, `forceRecomputeDetail`) and retarget `resendResultEmails`/`summarizeMatch`/`deleteMatch` redirects in `actions.ts`; extract the shared save helper.
2. Build the detail-page action UI (edit form, result form, maintenance controls) and extend the `OUTCOME` map / `pickOutcome`.
3. Add/relocate `admin.detail.*` i18n keys for all four locales.
4. Simplify the list row to display + indicators + Open; remove dead imports.
5. Remove confirmed-unused i18n keys; run lint/build/typecheck.

No data migration. Rollback is a straight revert of the UI/action-wrapper commit; the underlying actions and schema are unchanged.

## Open Questions

- Should the one-shot **Summarize** (creates the first *active* recap via `summarizeMatch`) remain distinct from **Regenerate** (creates a *draft* via `regenerateMatchSummary`) on the detail page, or be folded into the recap section as "Generate recap" shown only when no version exists? Default: keep both, place Summarize in the recap section's empty state. Adjust during implementation if it reads as redundant.
