## 1. Data model migration

- [x] 1.1 Create a new timestamped migration (e.g. `supabase/migrations/20260616120000_match_summaries_versions.sql`) that: drops the `match_summaries_match_uq` UNIQUE constraint on `match_id`; adds `style_key text not null default 'neutral'`, `style_instruction text`, and `is_active boolean not null default false`
- [x] 1.2 In the same migration, backfill existing rows with `update match_summaries set is_active = true` (each match has at most one today), then create `create unique index match_summaries_active_uq on match_summaries (match_id) where is_active` and a plain `create index match_summaries_match_id_idx on match_summaries (match_id)`
- [x] 1.3 In the same migration, replace the public-select RLS policy `match_summaries_select_public` so it uses `USING (is_active)` (drop + recreate), keeping writes service-role only
- [x] 1.4 Regenerate `lib/database.types.ts` for the new `match_summaries` columns

## 2. Generator: style injection + regenerate mode

- [x] 2.1 In `lib/matches/match-summary.ts`, add `STYLE_PRESETS: Record<string, string>` (`neutral` → `""`, plus `dramatic`, `tactical`, `concise` instruction fragments) and a `SummaryStyle = { key: string; instruction: string | null }` type
- [x] 2.2 Extend `buildSummaryPrompt(match, events, styleInstruction?)` to append a non-empty `styleInstruction` to the system prompt **after** the grounding/"never invent" constraints; keep it pure/exported for testing
- [x] 2.3 Extend `generateMatchSummary(admin, matchId, opts?)` with `opts.mode: "auto" | "regenerate"` (default `"auto"`) and `opts.style?: SummaryStyle`; in `"auto"` keep current idempotent semantics but change the existence check to tolerate multiple rows (fetch up to 1, e.g. `.select("id").eq("match_id", matchId).limit(1)`), and insert with `is_active: true`, `style_key: 'neutral'`
- [x] 2.4 In `"regenerate"` mode, skip the existence check and always insert a new draft (`is_active: false`) carrying `style_key` + `style_instruction`; return the new version id (extend `GenerateResult` with an optional `summaryId`); keep the auto path's 23505→`exists` handling (now against the partial active index)
- [x] 2.5 Confirm `generatePendingSummaries` still diffs "has any version" correctly against the multi-row table and continues to bucket non-generated results as skipped

## 3. Admin server actions

- [x] 3.1 In `app/[locale]/(admin)/admin/matches/actions.ts`, add `regenerateMatchSummary(formData)`: `assertAdmin` → managed → parse `match_id`/`locale`/`style_key`/optional `style_instruction` (zod; require instruction when `style_key === 'custom'`, trim + length-cap) → `assertMatchInManaged` → resolve style (preset fragment or custom text) → `generateMatchSummary(admin, matchId, { mode: 'regenerate', style })` → map to `regenResult` (`generated` | `no-events` | `not-final` | `no-key` | `missing` | `error`) → `revalidateAfterMutation` → `redirect` to the detail page with `regenMatchId` + `regenResult`
- [x] 3.2 Add `setActiveSummaryVersion(formData)`: admin + managed + `assertMatchInManaged`; parse `summary_id` + `match_id` (verify the version belongs to the match); set all the match's versions inactive, then set the chosen one active; revalidate (incl. public `/matches/[matchId]` when managed active); redirect with `activateResult=activated`
- [x] 3.3 Add `deleteSummaryVersion(formData)`: admin + managed + `assertMatchInManaged`; parse `summary_id` + `match_id`; refuse when the row is active (`deleteResult=active-blocked`), else delete (`deleteResult=deleted`); revalidate; redirect to the detail page
- [x] 3.4 Wrap each action's generator/DB work so a throw maps to an inline error outcome (e.g. `regenResult=error`) instead of a server-error page

## 4. Admin detail page + list link

- [x] 4.1 Create `app/[locale]/(admin)/admin/matches/[matchId]/page.tsx`: validate locale + `setRequestLocale`, `getTranslations("admin")`, resolve managed competition, `assertMatchInManaged` (else `notFound()`), load match + ordered `match_events` + all `match_summaries` versions (service-role, ordered `generated_at` desc)
- [x] 4.2 Render the header + fixture section: `AdminPageHeader` (teams/score/status, eyebrow, back link to `/admin/matches`) and a read-only fixture info block reusing `TeamFlag` / `MatchStateBadge` / `LocalTime` / `VenueImage`, plus a server-rendered event timeline (empty state when no events)
- [x] 4.3 Render the recap-versions section: list each version (content, `style_key` badge, model, `generated_at`) with an **Active** badge on the active one; per non-active version a `setActiveSummaryVersion` form (`SubmitButton`) and a confirm-gated `deleteSummaryVersion` form; empty state when no versions
- [x] 4.4 Create `components/admin/regenerate-summary-form.tsx` (client): preset style picker (neutral/dramatic/tactical/concise radios) + custom free-text textarea + hidden `match_id`/`locale` + `SubmitButton` posting to `regenerateMatchSummary`; render it in a "Regenerate" `FormSection`, disabled with an explanatory notice when the match has no events or the generator key is unset
- [x] 4.5 Parse `regenResult`/`activateResult`/`deleteResult` (+ ids) from query params and render matching `ActionStatus` panels; mount one `LiveRegion` for announcements (mirror the list-page pattern)
- [x] 4.6 In `app/[locale]/(admin)/admin/matches/page.tsx`, add an "Open" link per match row to `/admin/matches/[matchId]` (and make the existing "recap ready" badge link there)

## 5. Public surfaces show the active version

- [x] 5.1 In `app/api/matches/[matchId]/live/route.ts`, filter the `match_summaries` read to `.eq("is_active", true).maybeSingle()` so only the active version is exposed
- [x] 5.2 In `app/[locale]/(public)/matches/[matchId]/page.tsx`, filter the recap query to the active version (`.eq("is_active", true).maybeSingle()`) and keep omitting the section when none exists

## 6. Localization

- [x] 6.1 Add the new `admin` keys to `messages/en.json`: detail page header/back/section titles, fixture + events labels, recap-version labels (active/draft/style/model/generated), set-active + delete (+ confirm) labels, regenerate section + button + pending labels, style preset names (neutral/dramatic/tactical/concise) + custom label/placeholder, the list "Open" link, and one message per outcome (`generated`, `no-events`, `not-final`, `no-key`, `error`, `activated`, `deleted`, `active-blocked`)
- [x] 6.2 Mirror the identical key set in `messages/es.json` and `messages/fr.json`

## 7. Tests & verification

- [x] 7.1 Extend `tests/match-summary.test.ts`: update existing inserts to assert the new columns (`style_key`/`is_active`); add a `buildSummaryPrompt` case asserting a style instruction is appended; add an auto-path case asserting `is_active: true` + skip-when-any-version-exists with multiple rows
- [x] 7.2 Add generator regenerate-mode tests: always inserts a new draft (`is_active: false`) with the supplied `style_key`/`style_instruction`, returns the new `summaryId`, and is not blocked by an existing version; preserves `no-events`/`not-final`/`no-key` gates
- [x] 7.3 Add action tests (mirroring `tests/summarize-match-action.test.ts`) for `regenerateMatchSummary`, `setActiveSummaryVersion`, and `deleteSummaryVersion`: admin gate, managed scope, outcome→redirect-param mapping, and the delete-active-blocked guard
- [x] 7.4 Run `npm run lint`, `npm run typecheck`, `npm run test` (i18n parity must pass)
