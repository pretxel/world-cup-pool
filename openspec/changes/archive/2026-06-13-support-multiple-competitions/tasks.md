## 1. Migrations — competitions spine & scope

- [x] 1.1 M1: create `public.competitions` (slug, name/short_name, season, tournament_start_at, opening fixture fallback, format_config jsonb, providers jsonb, branding jsonb, is_active) + partial unique index `(is_active) where is_active` + `set_updated_at` trigger + `format_config` shape-validation trigger.
- [x] 1.2 M1: add `active_competition_id()` (sql stable security definer, grant anon+authenticated) and `set_active_competition(p_id uuid)` (definer, is_admin guarded, single-statement flip, raises on unknown id); add competitions RLS + grants. (Plus a guard trigger so `is_active` only changes via the RPC.)
- [x] 1.3 M2: insert the World Cup 2026 row — format_config = legacy enum + groups `^[A-L]$`, providers + branding from current literals, `is_active = true`.
- [x] 1.4 M3: add `matches.competition_id uuid` references competitions (`on delete restrict`), backfill by slug to WC2026, set `NOT NULL`; add `(competition_id, kickoff_at)` and `(competition_id, status)` indexes.
- [x] 1.5 M4: add `validate_match_against_competition()` BEFORE INSERT/UPDATE trigger; run guarded all-rows validation `DO` block; drop the `stage` + `group_code` CHECKs; add residual backstop CHECK (`stage` not null, `group_code` length ≤ 8).
- [x] 1.6 M5: rewrite `v_leaderboard_overall`, `leaderboard_for_day()`, and the group board with the active-competition `matches` join (group board scopes to the group's own competition in M6); recreate predictions RLS with the active-competition clause (preserving the `status='scheduled'` lock); re-grant. _Parity diff to run when a DB is available._
- [x] 1.7 M6: add `groups.competition_id` (`on delete restrict`, backfill to WC2026, `NOT NULL`); update `create_group()` to stamp the active competition and `generate_join_code(prefix)` to use the competition prefix; scope the group board.
- [x] 1.8 M7: parameterize `supabase/seed/matches.sql` (INSERT…SELECT resolving `competition_id` by slug) + the `generate-fixtures-sql.mjs` generator; replace the 104-row assertion with a per-competition count.
- [x] 1.9 Rollback documented inline in each migration header (Supabase migrations are forward-only; no separate down-files in this repo). _Apply/verify pending a DB._

## 2. Types & competition context

- [~] 2.1 Hand-wrote `lib/database.types.ts` additions (competitions table, `matches.competition_id`, `groups.competition_id`, `active_competition_id`/`set_active_competition`/`generate_join_code` fns) + `CompetitionRow` alias. _Regen from the real DB pending Docker._ **`MatchStage` widening deferred to the UI-refactor groups (3/5/6)** — widening it before its `STAGE_KEYS[...]` consumers are refactored reds the build.
- [x] 2.2 Add `lib/competition.ts`: `getActiveCompetition()` (React `cache`) + `resolveCompetition()`. Pure helpers (`getStageLabel`/`getStageOrder`/`hasGroupStage`/`groupCodePattern`/`sortedStages`/`getStageConfig`) live in `lib/competition-schema.ts` so they're client-safe.
- [x] 2.3 Added `lib/competition-schema.ts` (Zod) mirroring the DB validation; unit-tested resolvers + valid/invalid stage, group pattern, league-only (`tests/competition-schema.test.ts`).

## 3. Domain libraries

- [x] 3.1 Public stage labels now resolve from `format_config` via `getStageLabel`/`getActiveStageLabel` (matches list/detail, share/pick, OG); `MatchStage` widened to an open string; `StageIcon` already has a generic fallback. _`match-utils.stageLabel` English fallback kept._
- [x] 3.2 `tournament-countdown.tsx` resolves opening fixture + start from `getActiveCompetition()` (scoped query + `opening_*`/`tournament_start_at`), keeping `lib/tournament.ts` constants as the cold-start fallback.
- [x] 3.3 `lib/news.ts` `buildNewsRequestUrl`/`fetchNewsFeed` take a `query` (default `NEWS_QUERY`) so the cron can pass `branding.newsQuery`. (`lib/group-standings.ts` had no WC literal.)

## 4. Result sync

- [x] 4.1 `ResultProvider.fetchMatches(dates?, config?)` gains a `ProviderConfig`; football-data + ESPN build URLs from it (WC defaults). Test mocks updated.
- [x] 4.2 `runSync({ competitionId? })` resolves the competition (default active) + its `providers`, loads matches `.eq('competition_id', …)`, scopes the dedupe key, and passes the config into every `fetchMatches`.
- [x] 4.3 Cron `runSync()` scopes to the active competition (parameterless); admin `syncNow` now passes `{ competitionId: managedId }` (see 13.3). Result-email dispatch inherits the scope.

## 5. Admin & UI

- [x] 5.1 Admin Competition control delivered via the competitions surface + `SetActiveDialog` → `setActiveCompetition` RPC with path/tag revalidation (Groups 11/14).
- [x] 5.2 Admin matches forms now generate stage options + `group_code` validation from the managed competition's `format_config` (native selects, the repo's admin convention); `fixtureSchema` is built per-request and stamps `competition_id` (Group 13).
- [x] 5.3 Public surfaces updated: matches list/detail stage labels from format, my-picks group-stage query keyed off the competition group key + scoped + gated on group stage, match-detail group sim gated on group key, share/pick + OG routes, tournament-countdown, logotype `edition` prop.

## 6. Branding & i18n

- [x] 6.1 Added `getActiveBranding()` (short_name + `branding`, WC defaults). Wired: `app/layout.tsx` (now `generateMetadata` + branded JSON-LD), `app/[locale]/layout.tsx` (title template + OG siteName), OG rank + pick (`{brandCode} POOL`), `site-nav` aria-label, email from-name (`dispatchResultEmails(fromName)` from the cron), and news query (sync-news passes `branding.newsQuery`). _Static `opengraph-image.alt.txt` left as-is._
- [~] 6.2 Stage labels live in `format_config.stages[].labels`; brand identifiers resolve from branding. **Deferred:** per-locale competition NAMES in `siteMeta`/footer copy (e.g. "Mundial 2026" vs "Coupe du monde 2026") — these stay localized WC strings; a real second competition needs per-locale branding before they generalize.
- [x] 6.3 `TRANSLATABLE_LOCALES` and the quiz revalidate loop now derive from `lib/i18n` `SUPPORTED_LOCALES`/`DEFAULT_LOCALE`.

## 7. Tests

- [x] 7.1 Added `supabase/tests/competition_invariants.sql` (transaction + rollback): format-shape validation (empty/duplicate/hasGroupCode), per-competition match validation (bad stage / bad group_code / knockout group_code / league-only valid + rejects group_code), single-active partial-index uniqueness, is_active guard, leaderboard scope parity. Runs clean against the local DB (`OK: competition invariants passed`, data untouched). Zod mirror in `competition-schema.test.ts`.
- [x] 7.2 `tests/result-sync-providers.test.ts` — football-data + ESPN URL construction (defaults + provider config); `getActiveCompetition` pure resolvers/stage-label fallbacks covered in `competition-schema.test.ts`; competition-scoped load/`byKey` covered in `result-sync.test.ts`.
- [x] 7.3 `tests/no-hardcoded-brand.test.ts` — asserts no `World Cup`/`WC26` literals in the de-hardcoded surfaces (layouts, site-nav, tournament-countdown); news/quiz query parameterized (news test stubs branding, fixtures generator updated).

## 9. Admin — managed-competition context (server)

- [x] 9.1 Added `lib/admin/managed-competition.ts` (`server-only`): request-cached `getManagedCompetition()` + `getManagedCompetitionId()` reading the `wcp_admin_managed_competition` cookie via the service-role client, falling back to the active competition (best-effort stale-cookie clear).
- [x] 9.2 `setManagedCompetition` server action (in competitions `actions.ts`): `assertAdmin`, validate id, httpOnly/sameSite=lax cookie, `revalidatePath('/admin','layout')`; never touches `is_active`.
- [x] 9.3 Added `scopedMatchesQuery(admin, managedId)` + `assertMatchInManaged(admin, matchId, managedId)` guards, used by the matches actions.

## 10. Admin — shared competition schema

- [x] 10.1 Add `lib/competition-schema.ts`: `stageSchema`, `groupsSchema` (discriminated union on `enabled`), `formatConfigSchema` (`superRefine`: non-empty stages, unique keys, `hasGroupCode` requires `groups.enabled`, `pattern` is valid regex), `providersSchema`, `brandingSchema`, top-level `competitionSchema`; per-locale labels requiring the default locale.
- [x] 10.2 Unit-test `competitionSchema` against valid + malformed configs (`tests/competition-schema.test.ts`), matching the DB shape-validation trigger's contract.

## 11. Admin — competition CRUD routes & actions

- [x] 11.1 Added `admin/competitions/page.tsx` (list via admin client, ACTIVE + MANAGING badges, fixture counts, Manage/Set active/Edit/Delete actions, empty-state).
- [x] 11.2 Added `competitions/new/page.tsx` + `[id]/page.tsx` sharing `CompetitionForm`; slug read-only once fixtures exist.
- [x] 11.3 Added `competitions/actions.ts`: `createCompetition` (force `is_active=false`, `competitionSchema`, slug/trigger errors, redirect to edit), `updateCompetition` (never touches `is_active`), `deleteCompetition` (guard active/seed/dependents via counts), `setActiveCompetition` (RPC + public revalidation), `setManagedCompetition` (cookie).
- [x] 11.4 `SetActiveDialog` (Base UI dialog) names outgoing/incoming, lists consequences, warns on zero fixtures, confirm not default-focused (Cancel `autoFocus`).

## 12. Admin — format editor component

- [~] 12.1 Used native styled `<select>`/checkbox controls (the repo's existing admin convention; the repo uses Base UI, not shadcn/Radix). Dedicated shadcn `select`/`switch` components not added.
- [x] 12.2 `components/admin/competition-form.tsx` includes the stages editor: add/remove/reorder (order from position), kind select, per-locale label inputs, icon, `hasGroupCode`; groups `enabled` toggle + pattern/count; live `formatConfigSchema.safeParse` inline errors (submit disabled while invalid).
- [~] 12.3 Added `ProvidersFields` + `BrandingFields` (serialize to hidden JSON inputs). Grouped as sections (not Tabs). **JSON escape hatch deferred.**

## 13. Admin — matches scoping

- [x] 13.1 `admin/matches/page.tsx` resolves `getManagedCompetition()`, filters `.eq('competition_id', managedId)`, drives stage `<select>` options + list labels from the managed `format_config`, hides `group_code` when no group stage. (Scope banner lives in the shell `ManagedContextBar`.)
- [x] 13.2 `admin/matches/actions.ts`: per-request stage/group validation from the managed format, stamps `competition_id = managedId`, rejects a mismatched posted `competition_id`, `assertMatchInManaged` guards on result/recompute/delete, and skips public revalidation when managed ≠ active.
- [x] 13.3 `runSync({ competitionId })` (default active); `syncNow` passes the managed id; cron stays parameterless.

## 14. Admin — shell, nav & i18n

- [x] 14.1 Added `admin/page.tsx` dashboard (active + managed cards, shortcut tiles); unauthenticated redirect target now `/admin`.
- [~] 14.2 Added `AdminShell` (sticky header + scrollable nav) wrapped from `layout.tsx` after the `is_admin` gate + `ManagedContextBar` (`role=status` calm / `role=alert` diverged) with an inline managed switcher. _`aria-current` on nav deferred (would need a client component for `usePathname`)._
- [~] 14.3 Added the quiz "applies to all competitions" hint. **Full `admin` i18n namespace keys deferred** — new admin surfaces use English literals for now.

## 15. Admin — tests

- [x] 15.1 `tests/managed-competition.test.ts` — default→active, cookie→competition, stale-cookie fallback+clear, null when none.
- [x] 15.2 `tests/matches-actions-scope.test.ts` — `saveFixture` stamps `managedId`, rejects mismatched `competition_id` + invalid stage; `setMatchResult`/`deleteMatch` reject cross-competition matches.
- [x] 15.3 `tests/competition-actions.test.ts` — `createCompetition` forces `is_active=false`; `deleteCompetition` guards active/seed/dependents. _DB-level `ON DELETE RESTRICT` assertion needs a live DB (deferred to 16)._

## 16. Validation & wrap-up

- [x] 16.1 Applied all 4 migrations + seed to the local self-hosted Supabase (docker) via `docker/apply-app-schema.sh`. Verified: WC2026 row active, 104 matches scoped, `active_competition_id()` resolves, functions/triggers/indexes present, old stage/group CHECKs dropped + residuals added. Functionally tested 7 trigger/guard cases (bad stage / bad group_code / knockout group_code / valid insert / unknown set_active / direct is_active blocked / empty format). Leaderboard view returns real scoped rows (20). Hand-written `database.types.ts` confirmed to match the real schema via introspection. `openspec validate` passes; 242 unit tests green. _Migrations are forward-only (rollback documented inline); no down-cycle run._
- [x] 16.2 Documented in the proposal/design: `quiz` + `news_articles` stay global and MUST be scoped before any real second competition is seeded (the admin quiz page also carries the hint).
