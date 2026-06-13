## Context

The app is a single-tournament prediction pool. The World Cup 2026 is baked into every layer:

- **DB:** `matches.stage` is a 7-value CHECK enum (`group,r32,r16,qf,sf,third,final`) and `group_code` is `^[A-L]$` (12 groups). `predictions`, `scores`, `v_leaderboard_overall`, and `leaderboard_for_day()` have no competition dimension. `groups` (friend boards) hardcode a `WC-` join-code prefix.
- **Domain:** `lib/tournament.ts` hardcodes the opening fixture and start ISO; `lib/match-utils.ts` and `components/stage-icon.tsx` `switch` over the stage enum; `lib/news.ts` hardcodes the news query.
- **Sync:** `lib/result-sync/providers/{espn,football-data}.ts` hardcode WC/2026 endpoints; `runSync()` scans all matches and dedupes on `home|away|date`.
- **Branding/i18n:** layout/OG metadata, email sender, logo edition, and ~38 strings across `messages/{en,es,fr}.json` say "World Cup 2026".

Locked product decisions constrain the design: (1) **refactor only** — WC2026 stays the only seeded competition; (2) **exactly one active competition** site-wide, admin-switchable; (3) **per-competition format config** that must express group-stage, knockout, and a single league phase (Champions League "Swiss").

## Goals / Non-Goals

**Goals:**

- Make adding a future competition a data/config task (a `competitions` row + a seed file), not a code change.
- Let an admin stand up and edit a competition **through the admin UI** (format, providers, branding, fixtures) and go live with one confirmation — while the public site stays on the current competition.
- Preserve byte-identical WC2026 behavior: same pages, same leaderboard numbers, same locked rules.
- Keep the database the integrity authority — format and scope rules enforced in SQL (triggers, RLS, views), not only in app code.
- Keep the scoring engine (`compute_match_scores`, recompute trigger) literally unchanged.

**Non-Goals:**

- Seeding or shipping a second competition (Champions League/Euro/Libertadores) now.
- Multiple concurrent competitions or a per-user "current competition" selector (decision #2: single active).
- Scoping `quiz` and `news_articles` to a competition — explicitly deferred (documented follow-up before any second competition).
- Cross-competition aggregate leaderboards or historical archives.

## Decisions

### 1. Single-active competition via a partial unique index + definer RPC

Model "active" as `competitions.is_active boolean` with a partial unique index `(is_active) WHERE is_active`, switched only through `set_active_competition(p_id)` — a single `UPDATE competitions SET is_active = (id = p_id)`, `is_admin()`-guarded, raising on unknown id. Everywhere else resolves the active competition through `active_competition_id()` (SQL, `stable`, `security definer`, granted to anon+authenticated).

- **Why:** Decision #2 mandates exactly one active competition. The partial unique index makes "at most one" a DB invariant; making the RPC the sole mutation path (no direct `UPDATE` policy on the flag) and raising on unknown id prevents the "zero active" failure mode that would blank every view. A single anchor function keeps views/RLS/sync/UI consistent.
- **Alternatives:** a single-row `app_config` table pointing at a `competition_id` (extra join, weaker invariant); a per-request cookie/header "current competition" (violates single-active, complicates RLS); most-recent-by-date (no admin control).

### 2. No `competition_id` on `predictions`/`scores` — scope transitively through `matches`

Add `competition_id` only to `matches` (and `groups`). `predictions` and `scores` stay competition-free; the leaderboard views add a `matches` join filtered on the active competition.

- **Why:** `competition_id` is functionally dependent on `match_id` (both FK `matches` with cascade delete). Denormalizing it onto `predictions`/`scores` invites drift and would force changes to `compute_match_scores()` and the recompute trigger. Transitive scoping keeps the scoring engine untouched and the model normalized. `v_leaderboard_overall` is the only view lacking a `matches` join today, so the change is small.
- **Alternatives:** a trigger-maintained `scores.competition_id` mirror (faster joins, drift risk, more triggers) — kept as a documented, non-breaking follow-up if profiling shows the join is hot.

### 3. Replace hardcoded `stage`/`group_code` CHECKs with a trigger validating per-competition `format_config` (JSONB)

Drop the `matches.stage` and `matches.group_code` CHECKs; add a `BEFORE INSERT/UPDATE` trigger `validate_match_against_competition()` that validates `stage` against `format_config.stages[].key` and `group_code` against the competition's group pattern (NULL when the stage is non-group or groups are disabled). `format_config` shape is itself validated on write by a trigger on `competitions`.

`format_config` shape:

```json
{
  "stages": [
    { "key": "group", "kind": "group", "order": 1, "labels": {"en": "...", "es": "...", "fr": "..."}, "icon": "dots", "hasGroupCode": true }
  ],
  "groups": { "enabled": true, "pattern": "^[A-L]$", "count": 12 }
}
```

- WC2026 encodes today's exact enum + `groups {enabled, '^[A-L]$', 12}`. Euro = `^[A-F]$` + `group/r16/qf/sf/final`. Libertadores = `^[A-H]$`. Champions League = `groups {enabled:false}` + a single `{key:'league', kind:'league', hasGroupCode:false}` stage plus knockout rounds (group_code stays NULL).
- **Why:** Decision #3 needs per-competition formats without DDL. A trigger keeps the DB authoritative (service-role and admin writes go through it) while making format *data*. Existing WC rows pass unchanged.
- **Alternatives:** keep DDL enums and `ALTER` per competition (a code change each time — violates the goal); relational `stages`/`groups` child tables (more joins/migrations for marginal benefit at this scale); app-only validation (loses DB integrity, RLS-bypassable).

### 4. Thread provider config + competition scope through result-sync; don't change the algorithm

`runSync()` resolves the active competition, loads only its matches (`.eq('competition_id', …)`), makes the dedupe key competition-scoped, and passes the competition's `providers` JSONB into `fetchMatches()`. football-data/ESPN build URLs from that config. The `SyncSource` union (names providers, not competitions) is unchanged; `competitionId` defaults to active so cron/`syncNow` need no new params.

- **Why:** the pipeline is algorithmically competition-agnostic; only the hardcoded URLs and the global scan/dedupe key are coupled. Scoping the load fixes the candidate-date window and prevents same-day/same-team cross-competition key collisions once a second competition exists — with no behavioral change for WC2026.
- **Alternatives:** per-competition provider classes (duplication); leaving sync global and filtering post-fetch (collision risk, wasted requests).

### 4b. Admin manages a "managed competition" distinct from the public "active competition"

The admin needs to build/edit a competition *before* activating it, but admin actions use the service-role client (RLS-bypassing) so they are not auto-pinned to active. Introduce an admin-only **managed competition** context — an httpOnly, sameSite=lax cookie (`wcp_admin_managed_competition`) holding a competition id, resolved server-side by `getManagedCompetition()` (request-cached, loaded via the service-role client so a non-active row is readable). Absent/invalid/deleted → fall back to `active_competition_id()` and clear the stale cookie, so a fresh admin with only WC2026 manages WC2026 == active (zero behavior change). The fixtures/results/sync admin scopes to the **managed** competition; `set_active_competition` is the only thing that touches the public flag.

- **Why:** a cookie (vs a DB `managed_by` column or a `?competition=` URL param) keeps the selection private per-admin-browser, can't leak between admins or be confused with the public flag, survives navigation, and defaults trivially to active.
- **Service-role fence:** because admin writes bypass RLS, every mutating action re-derives `managedId` server-side and binds writes to it — `saveFixture` stamps `competition_id = managedId` and rejects any posted `competition_id` that differs; `setMatchResult`/`forceRecompute`/`deleteMatch` assert the target match belongs to `managedId` (a stale/forged `match_id` hits zero rows). A single missed filter would let a stale tab mutate the live competition, so the guard is centralized (`scopedMatchesQuery`/`assertMatchInManaged`).
- **Alternatives:** reuse the active flag for admin scoping (can't build a non-active draft — the exact tension); a DB `managed_by` column (leaks between admins, migration, confusion with `is_active`); a URL param (lost on navigation, threaded everywhere, no httpOnly).

### 4c. Structured format editor with a JSON escape hatch, one Zod schema mirroring the DB trigger

Author `format_config`/`providers`/`branding` through a structured shadcn form (stages add/remove/reorder with `order` from position, `kind`/`icon` selects, per-locale label tabs, presets; a groups `enabled` switch revealing `pattern` with a live regex→example-codes preview + `count`) — never raw JSON, with an "Advanced (JSON)" escape hatch that round-trips into the structured fields. A single shared `lib/competition-schema.ts` validates client form, server actions, and a unit test, and is a faithful mirror of the DB shape-validation trigger (non-empty stages, unique keys, valid `kind`, well-formed groups, `hasGroupCode` requires `groups.enabled`, valid regex). The DB trigger stays the final authority.

- **Why:** lets an admin stand up a brand-new competition end-to-end without code/SQL; sharing one schema across the three layers removes the "looked valid but the DB rejected it" drift.

### 4d. Set-active is confirmation-gated and the only public mutation; delete is guardrailed

Create/edit never write `is_active` (forced false on create). Activation is solely a confirmation-gated `<SetActiveDialog>` → `setActiveCompetition(id)` → `set_active_competition` RPC, naming the outgoing/incoming competition and consequences (public render, leaderboards, emails, sync, RLS all repoint; in-progress predictions on the old active become RLS-locked), with a zero-fixtures readiness warning. There is no bare "deactivate" (eliminates the zero-active blanking failure mode). `deleteCompetition()` refuses when the competition is active, is the WC2026 seed, or has any matches/predictions/groups; `slug` becomes read-only once fixtures exist; the DB enforces `ON DELETE RESTRICT` so the service role can't bypass the action-level guard. Promote the flat admin into a thin shell (index + nav + persistent `<ManagedContextBar>` with `role=status`/`role=alert`) so the active-vs-managed distinction is unmissable on every page.

### 5. i18n: generic placeholder copy + competition-supplied values, not per-competition message files

Split the ~38 WC strings into generic templates in `messages/{en,es,fr}.json` with placeholders (`{competitionName}`, `{dateRange}`, `{hosts}`, `{brandCode}`) plus per-competition values stored on the competition's `branding`. Stage labels move into `format_config.stages[].labels`. A request-time merge deep-merges competition values over static copy so missing keys fall back gracefully.

- **Why:** one translation surface, no message file per competition, runtime-switchable reskin with preserved en/es/fr fallbacks.
- **Alternatives:** `messages/{slug}/{locale}.json` subtrees (more files, duplicated generic copy); build-time literal swap (not runtime-switchable, violates the admin switch).

## Risks / Trade-offs

- **Dropping CHECKs before the validation trigger is proven could admit malformed rows** → In M4, create + verify the trigger and run a guarded `DO` block asserting all existing rows pass *before* dropping the CHECKs (same migration); keep a lightweight residual CHECK (`stage` not null, `group_code` length ≤ 8) as a backstop; paired down-migration restores the CHECKs.
- **Deactivating without activating another competition blanks every view** (`active_competition_id()` → NULL) → `set_active_competition()` is the only mutation path, raises on unknown id, and there is no bare "deactivate"; helpers treat NULL active as "no competition selected" gracefully.
- **Transitive scoping adds a `matches` join to hot leaderboard reads** → add the `(competition_id, kickoff_at)` composite index now; verify query plans; keep the optional `scores.competition_id` mirror as a documented follow-up. At ~104 rows the cost is negligible.
- **Widening `MatchStage` to `string` loses compile-time exhaustiveness** in stage `switch`es → validate stage ids at the admin/Zod boundary against `format_config`; unit-test that every active competition's stage keys resolve to a label and icon; keep a generic fallback icon.
- **RLS rejects an in-flight pick if an admin switches competitions mid-pick** → acceptable per single-active; surface a clear UI error and revalidate caches on switch so the client refetches.
- **Friend groups become bound to one competition on backfill** → backfill all groups to WC2026 (correct under single-active); existing `WC-` codes stay valid, only new codes use the prefix lookup; flag the one-way-door nature.
- **`quiz`/`news_articles` stay global** → out of locked scope but documented as a required follow-up (per-competition seed + `competition_id`) before any real second competition is seeded.

## Migration Plan

Ordered, additive, reversible SQL migrations (each with a paired down-migration):

1. **M1 — competitions spine:** `competitions` table + partial-unique-active index + `updated_at` trigger + `format_config` shape-validation trigger + `active_competition_id()` + `set_active_competition()` + RLS/grants.
2. **M2 — seed WC2026 row:** insert the WC2026 competition (`format_config` = legacy enum, `providers`, `branding` from current literals), `is_active = true`.
3. **M3 — scope matches:** add `matches.competition_id` (FK `competitions` `ON DELETE RESTRICT`), backfill by slug to WC2026, set `NOT NULL`, add `(competition_id, kickoff_at)` and `(competition_id, status)` indexes.
4. **M4 — format trigger:** add `validate_match_against_competition()`, run guarded all-rows validation, then drop the `stage` + `group_code` CHECKs (keep residual backstop CHECK).
5. **M5 — scope reads:** rewrite `v_leaderboard_overall` / `leaderboard_for_day` / group board with the active-competition join; recreate predictions RLS with the active-competition clause; re-grant; pre/post parity diff.
6. **M6 — scope groups:** add `groups.competition_id` (FK `competitions` `ON DELETE RESTRICT`, backfill, `NOT NULL`), update `create_group()` / `generate_join_code()` for the competition prefix, scope "my groups". (`ON DELETE RESTRICT` on the competition FKs is what lets the admin `deleteCompetition` guard rely on the DB to refuse orphaning dependents.)
7. **M7 — seed parameterization:** make `seed/matches.sql` resolve `competition_id` by slug, replace the 104-row assertion with a per-competition count helper, drop now-redundant single-column `matches` indexes.

**Rollback:** down-migrations reverse each step; because every migration is additive and WC2026 is backfilled before constraints tighten, the app keeps working at every intermediate step. M5's parity diff is the gate — if pre/post leaderboard output differs for the single active competition, halt and roll back M5.

## Open Questions

- Should `branding` per-locale strings live in `competitions.branding` JSONB (chosen) or in a dedicated `competition_translations` table? JSONB is simpler now; revisit if competitions accumulate many locales.
- When `quiz`/`news` are later scoped, do friend `groups` migrate across competitions or stay frozen to their creation competition? (Leaning frozen; out of scope here.)
- Does the admin Competition control belong on the existing admin matches page or a dedicated `/admin/competitions` route? (Implementation detail for the apply phase.)
