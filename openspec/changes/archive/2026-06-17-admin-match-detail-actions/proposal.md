## Why

The `/admin/matches` list row is overloaded: each fixture carries an inline result form, a collapsible full-edit form, and a strip of maintenance buttons (force recompute, resend emails, summarize, delete). This makes the list hard to scan and slow to act on, and it duplicates context that already has a natural home — the per-match detail page at `/admin/matches/[matchId]`. Moving editing and per-match actions onto the detail page makes the list a clean, scannable index and gives each fixture a single, focused workspace.

## What Changes

- Simplify the `/admin/matches` list so each row shows only read-only fixture information (teams, score, status, stage, kickoff) plus the existing scan indicators (Unconfirmed / Stale) and a single **Open** link to the detail page. The global header controls (managed-competition context, **New fixture** create form, **Sync results now**) stay on the list.
- **Remove from each list row**: the inline result-entry form, the collapsible **Edit fixture** form, and the per-match maintenance buttons (Force recompute, Resend result emails, Summarize, Delete fixture).
- **Add to the detail page** `/admin/matches/[matchId]` the per-match workspace, built from the existing server actions:
  - **Edit fixture** form (`stage`, `group_code`, `home_team`, `away_team`, `kickoff_at`, `venue`) → `saveFixture`.
  - **Result entry** form (`home_score`, `away_score`, `status`) → `setMatchResult`.
  - **Force recompute scores** → `forceRecompute`.
  - **Resend result emails** (shown only for `final` matches) → `resendResultEmails`.
  - **Delete fixture** (confirm-gated, destructive) → `deleteMatch`, which redirects back to the list since the detail page ceases to exist.
- Surface each action's outcome inline on the detail page (same query-param redirect pattern already used there), and localize all new labels and messages for en/es/fr/de.
- No server-action signatures or database schema change — this is a UI relocation. Existing managed-competition scoping, admin gating, and validation are reused as-is.

## Capabilities

### New Capabilities
<!-- none — this reorganizes existing capabilities -->

### Modified Capabilities
- `admin-fixture-editing`: The edit-fixture form, result entry, force-recompute, resend-result-emails, and delete-fixture controls move OFF each `/admin/matches` list row and ONTO the `/admin/matches/[matchId]` detail page; the list keeps only read-only display, scan indicators, and an Open link. The header-level create-fixture and sync controls are unchanged.
- `admin-match-detail`: The detail page gains fixture editing, result entry, and per-match maintenance actions (force recompute, resend emails for final matches, delete-with-redirect), each with inline localized outcome reporting, alongside its existing read-only info, event timeline, and recap-version management.

## Impact

- **Code**:
  - `app/[locale]/(admin)/admin/matches/page.tsx` — strip per-row forms/buttons down to display + Open.
  - `app/[locale]/(admin)/admin/matches/[matchId]/page.tsx` — add edit/result/maintenance action UI; extract reusable form/button components as needed.
  - `app/[locale]/(admin)/admin/matches/actions.ts` — reuse existing actions; `deleteMatch` redirects to the list when invoked from the detail context; verify revalidation paths still cover the detail route.
  - Client form components (e.g. `SubmitButton`, summarize/resend buttons) move or are re-imported on the detail page.
- **i18n**: `messages/{en,es,fr,de}.json` — relocate/extend admin keys so edit/result/maintenance labels and outcomes are available under the detail namespace; remove now-unused list-row keys.
- **Specs**: delta updates to `admin-fixture-editing` and `admin-match-detail`.
- **No change** to: server-action contracts, Supabase schema, managed-competition scoping logic, scoring RPCs, or public-facing surfaces.
