## Why

The entire stack is hardwired to World Cup 2026: `matches` CHECK-constrains `stage` to a 7-value enum and `group_code` to `^[A-L]$`; predictions, scores, and leaderboards are globally scoped with no notion of a competition; and tournament constants, result-sync endpoints, branding, and ~38 i18n strings are WC-specific. Adding any future competition (Champions League's Swiss league phase, Euro, Libertadores) currently means code changes across the database, domain, UI, sync, and branding. This refactor makes the architecture competition-agnostic so that adding a competition later becomes a **data/config task, not a code change** — while keeping World Cup 2026 as the only seeded competition with byte-identical behavior today.

## What Changes

- Introduce a `public.competitions` spine table: per-competition `slug`, `name`/`short_name`, `season`, `tournament_start_at`, opening-fixture fallback, `format_config` (JSONB), `providers` (JSONB), `branding` (JSONB), and an `is_active` flag, with a partial unique index enforcing **at most one active competition** site-wide.
- **BREAKING (DB write contract):** add `matches.competition_id uuid NOT NULL` referencing `competitions(id)`, backfilled to WC2026; add composite indexes `(competition_id, kickoff_at)` and `(competition_id, status)`.
- **BREAKING (DB integrity contract):** drop the hardcoded CHECK constraints on `matches.stage` and `matches.group_code`; replace with a `BEFORE INSERT/UPDATE` trigger that validates `stage` against the competition's `format_config.stages` keys and `group_code` against the competition's group pattern (or NULL when the stage is non-group / groups disabled).
- **BREAKING (leaderboard semantics):** `v_leaderboard_overall`, `leaderboard_for_day()`, and the group board add a `matches` join filtered to the active competition. Output row shapes and function signatures are unchanged, so callers are untouched.
- **BREAKING (RLS):** predictions insert/update and select-after-final policies gain an active-competition clause, so users cannot predict on or read non-active-competition fixtures.
- **BREAKING (TS type):** widen `lib/db.ts` `MatchStage` from a literal union to a branded string; drive stage labels/icons/keys from the active competition's `format_config` instead of switch statements.
- **BREAKING (result-sync provider API):** `ResultProvider.fetchMatches` gains a provider-config argument; football-data and ESPN build URLs from the active competition's `providers` JSONB instead of hardcoded WC/2026 and `fifa.world`. `runSync()` resolves and scopes to the active competition, filters local matches by `competition_id`, and makes the dedupe key competition-scoped.
- Add a server-resolved active-competition context (`getActiveCompetition()` cached per request; `active_competition_id()` security-definer SQL helper) consumed by views, RLS, domain, UI, sync, and branding.
- Add an admin **Competition** control backed by a `set_active_competition()` definer RPC that flips `is_active` in one statement and revalidates affected paths/tags.
- Add `competition_id` to `public.groups` (friend boards), backfilled to WC2026 and stamped at create time; `generate_join_code()` uses the competition's prefix (stays `WC-` for WC2026).
- Replace hardcoded WC literals (tournament constants, news query, email sender name, OG/metadata, footer/nav copy) with values resolved from the active competition; split the ~38 WC i18n strings into generic placeholder copy plus competition-supplied values.
- Keep `supabase/seed/matches.sql` as the canonical WC2026 seed (resolving `competition_id` by slug); replace the hardcoded 104-row assertion with a per-competition count helper.

Admin section (handle multiple competitions):

- Add an admin **Competitions** surface (`/admin/competitions` list + `new` + `[id]` edit + `actions.ts`) to create, edit, and list competitions and author `format_config`, `providers`, and `branding` through a structured form (no raw JSON required) — so adding a future competition is a data task done through the admin UI. New competitions are always created with `is_active = false`.
- Add an admin-only **managed competition** context (httpOnly cookie `wcp_admin_managed_competition`, resolved by `getManagedCompetition()` in a `server-only` `lib/admin/managed-competition.ts`) distinct from the public active competition. It defaults to the active competition and is switched by a non-destructive `setManagedCompetition(id)` action. WC2026-only steady state: managed == active, behavior byte-identical.
- **BREAKING (admin write scope):** the admin fixtures/results/sync surface re-scopes from "all matches" to the MANAGED competition — list `.eq('competition_id', managedId)`; `saveFixture` stamps + validates against `managedId`; `setMatchResult`/`forceRecompute`/`deleteMatch` assert the target match belongs to `managedId`. Service-role writes are fenced by a server-derived managed-scope guard (the form's `competition_id` is never trusted).
- **BREAKING (sync API):** `runSync()` gains an optional `competitionId` (defaults to `active_competition_id()` so cron stays parameterless); admin `syncNow` passes `{ competitionId: managedId }`. Revalidation skips public paths/leaderboard tag when managed ≠ active.
- Add a shared `lib/competition-schema.ts` (Zod) mirroring the DB `format_config` trigger, used by the client editor, the server actions, and a unit test (one validator across client/server/DB), plus a structured **format editor** component with reorderable stages, presets, per-locale labels, a groups `enabled` switch with live regex preview, and a JSON escape hatch.
- Set-active is the only admin path that flips public `is_active`: a confirmation-gated `<SetActiveDialog>` → `setActiveCompetition()` → existing `set_active_competition` RPC, naming outgoing/incoming + consequences, with a zero-fixtures readiness warning. No bare "deactivate".
- Guardrail `deleteCompetition()`: refuse when active, the WC2026 seed, or has any matches/predictions/groups; make `slug` read-only once fixtures exist; enforce `ON DELETE RESTRICT` at the DB.
- Promote the flat admin into a thin shell: a new `/admin` index, persistent nav (Dashboard / Competitions / Matches / Quiz), and a `<ManagedContextBar>` (calm `role=status` when managed == active, amber `role=alert` when diverged) on every admin page; redirect target `/admin/matches` → `/admin`. Add shadcn `select` + `switch`; extend the `admin` i18n namespace.

Out of scope (flagged follow-up): `quiz` and `news_articles` stay global in this refactor and MUST be scoped to a competition before any real second competition is seeded.

## Capabilities

### New Capabilities

- `competition-management`: The competitions registry, the exactly-one-active-competition invariant (partial unique index + `set_active_competition` RPC), the `active_competition_id()` / `getActiveCompetition()` resolution contract, and the admin control to switch the active competition with cache revalidation.
- `competition-format`: The per-competition `format_config` (stages with keys/order/labels/icons, group pattern/enabled), the trigger-based validation that replaces the hardcoded `stage`/`group_code` CHECKs, and the requirement that a format express group-stage, knockout, and single league-phase shapes without code changes.
- `admin-competitions`: The admin UI to create/edit/list competitions, author `format_config`/`providers`/`branding` via a structured form, set the public active competition through a confirmation-gated guarded RPC, and safely delete an empty non-active competition.

### Modified Capabilities

- `leaderboard`: Overall and per-day leaderboards scope to the active competition via a `matches` join; row shapes and signatures unchanged.
- `predictions-lock`: RLS additionally requires the target match to belong to the active competition for insert/update and for cross-user reads after final, on top of the existing kickoff/status gates.
- `match-presentation`: Stage labels, stage icons, and `STAGE_KEYS` derive from the active competition's `format_config` rather than a hardcoded WC stage enum, with a generic fallback for unknown stages.
- `admin-fixture-editing`: Stage options and `group_code` validation are generated from `format_config`; the group input is hidden when the competition has no group stage; the fixtures/results/sync admin scopes to the **managed** competition (equal to active in the WC2026-only case), stamping and guarding `managedId` on every write.
- `group-simulation`: Group standings/simulation render only when the active competition has a group stage; the query keys off the competition's group-stage key instead of the literal `'group'`.
- `automated-results`: Result sync resolves the active competition, scopes match loading and the dedupe key by competition, and builds provider URLs from the competition's `providers` config.
- `brand-identity`: Site name, title templates, keywords, OG cards/alt text, email sender, news query, logo edition, and footer/nav copy resolve from the active competition rather than hardcoded WC2026 literals.
- `groups`: Friend boards belong to a competition (`competition_id`), are created scoped to the active competition, and use a competition-derived join-code prefix; "my groups" filters to the active competition.

## Impact

- **Database (BREAKING):** new `public.competitions`; `matches.competition_id`; `stage`/`group_code` CHECKs → trigger; `v_leaderboard_overall` / `leaderboard_for_day` / group board rewritten with competition scope; predictions RLS tightened; `groups.competition_id`; `create_group`/`generate_join_code` parameterized; new `active_competition_id()` / `set_active_competition()`; `database.types.ts` regenerated.
- **Domain:** `lib/db.ts` (`MatchStage`), new `lib/competition.ts`, `lib/tournament.ts`, `lib/match-utils.ts`, `lib/news.ts`, `lib/group-standings.ts`.
- **Result-sync (BREAKING provider API):** `lib/result-sync/core.ts`, `types.ts`, `providers/football-data.ts`, `providers/espn.ts`; `app/api/cron/sync-matches`; admin matches `actions.ts`.
- **UI/admin:** `components/stage-icon.tsx`, `tournament-countdown.tsx`, `logotype.tsx`, `site-nav.tsx`; `app/[locale]/(public)/matches` (list + `[matchId]` + `share/pick`), `(app)/my-picks`.
- **Admin section (multi-competition):** new `app/[locale]/(admin)/admin/page.tsx` (index), `admin/competitions/{page,new,[id]}` + `actions.ts`; modified `admin/layout.tsx` (shell/nav, redirect → `/admin`), `admin/matches/{page,actions}.ts` (managed scope), `admin/quiz/page.tsx` (shell + "global" hint); new `lib/admin/managed-competition.ts`, `lib/competition-schema.ts`, `components/admin/*` (format-editor, providers/branding fields, stage-select), admin shell/context-bar/switcher/set-active-dialog; new shadcn `select`+`switch`; `runSync()` gains optional `competitionId`; `ON DELETE RESTRICT` on competition FKs.
- **Branding/i18n:** `app/layout.tsx`, `app/[locale]/layout.tsx`, OG routes, `opengraph-image.alt.txt`, `lib/env.ts`, `messages/{en,es,fr}.json`.
- **Seed/tests:** `supabase/seed/matches.sql`; new tests for format validation, leaderboard parity, competition resolvers, sync scoping, and a no-residual-WC-literal guard.
- **No public-facing behavior change today:** WC2026 remains the only seeded, active competition and renders identically.
