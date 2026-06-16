# Improve admin/matches: fixture detail page with recap versioning & styled regeneration

## Why

The admin `/admin/matches` view is a single flat list with inline per-row controls and no way to drill into a fixture. Recaps are at-most-one-per-match and can only be generated once (the generator is idempotent and skips when a recap exists), so an admin who wants a different recap has no path to it. Admins need a focused fixture detail page where they can read the fixture and its events, see the generated recap, and regenerate alternate styled versions to choose the best one for viewers.

## What Changes

- **New admin fixture detail page** at `/admin/matches/[matchId]`: read-only fixture info + event timeline, the recap versions for the match, and the regeneration controls. Reachable via an "Open" link from each row of the management list.
- **Recap version history** — **BREAKING** (data model): drop the `UNIQUE (match_id)` constraint on `match_summaries`; a match MAY now hold multiple recap versions. Exactly one version per match is `is_active` (a partial unique index enforces this). Add `style_key`, `style_instruction`, and `is_active` columns. Existing rows are backfilled as the active `neutral` version.
- **Styled regeneration** — admins can generate a new recap version by picking a preset style (neutral / dramatic / tactical / concise) or supplying a free-text custom instruction. The style is injected into the generation system prompt. Each regeneration is stored as a **draft** version (`is_active = false`).
- **Deliberate publish step** — a regenerated draft does not change what viewers see. The admin marks a version active ("Set active") to publish it; an admin may also delete a non-active draft version.
- **Public surfaces the active version** — the per-match live API and the public match-detail view show the `is_active` recap (drafts never leak to anon reads). Public `select` RLS is narrowed to active rows.
- **Generator extension** — `buildSummaryPrompt` accepts an optional style instruction; `generateMatchSummary` gains an explicit `regenerate` mode that always inserts a new draft version (bypassing the idempotent "exists" skip), while the existing auto/cron path keeps inserting the first recap as the active `neutral` version.

## Capabilities

### New Capabilities
- `admin-match-detail` — the admin fixture detail page: reachable from the management list; renders fixture info + event timeline; lists recap versions with an active indicator; regenerate-with-style, set-active (publish), and delete-draft controls; localized inline outcomes; gated on event data and generator availability.

### Modified Capabilities
- `match-ai-summary` — recaps become versioned (multiple per match, one active) with a persisted `style_key`/`style_instruction`; the generation prompt accepts an optional style instruction; the auto/cron path stores its recap as the active version; viewers (live API + match-detail) surface the active version rather than "the" single summary.

## Impact

- **Database**: new migration on `match_summaries` (drop unique, add 3 columns, backfill, partial unique active index, plain `match_id` index, narrow public-select RLS to `is_active`).
- **Code**:
  - `lib/matches/match-summary.ts` — style presets, prompt style injection, `regenerate` mode + draft inserts, version-aware existence check.
  - `app/[locale]/(admin)/admin/matches/actions.ts` — `regenerateMatchSummary`, `setActiveSummaryVersion`, `deleteSummaryVersion` actions.
  - `app/[locale]/(admin)/admin/matches/[matchId]/page.tsx` — new detail route; `page.tsx` list gets an "Open" link.
  - `components/admin/regenerate-summary-form.tsx` — new style-picker client component.
  - `app/api/matches/[matchId]/live/route.ts` and `app/[locale]/(public)/matches/[matchId]/page.tsx` — filter to the active recap version.
  - `lib/database.types.ts` — regenerated types for the new columns.
- **i18n**: new `admin` keys for the detail page, style presets, and action outcomes across `en`/`es`/`fr` (parity test).
- **Tests**: generator regenerate/style cases; the three new actions; updated existing `match-summary` tests for versioned inserts.
