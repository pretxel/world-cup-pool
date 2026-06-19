## Context

Results from ESPN (and the Football-Data fallback) already flow into `public.matches` via the result-sync pipeline (`automated-results`): each fixture carries `home_score`, `away_score`, and a `status` of `scheduled | live | final | cancelled`, plus `group_code` and `stage`. The app has a standings *math engine* — `simulateGroup`/`simulateAllGroups` in `lib/group-standings.ts` — but it is currently wired only to a single user's predictions (`group-simulation`), and it explicitly never reads real results. There is no factual, public view of the actual group tables.

The engine itself is source-agnostic: it takes fixtures plus a `Map<matchId, {home_goals, away_goals}>` and produces ordered group rows using standard 3/1/0 football points. The only thing tying it to predictions is the call site that builds the map from `predictions`. This change adds a second call site that builds the map from `final` match results, and a public surface to render it.

Constraints:
- Next.js App Router with project-specific breaking changes — consult `node_modules/next/dist/docs/` before writing route/loader code.
- The active competition is resolved via `getActiveCompetition()`; the group-stage key comes from its format (`groupStageKey(format)`), and competitions without a group stage must degrade gracefully.
- Mobile-first, accessible, responsive; 12 groups of 4 must read well on small screens (the existing table already hides secondary columns at narrow breakpoints).

## Goals / Non-Goals

**Goals:**
- A public `/standings` page showing every group's real table, computed from synced `final` results for the active competition.
- Reuse the existing points/ordering engine rather than duplicating table logic.
- Generalize the presentational `GroupStandingsTable` so the same markup serves both the predicted ("from your picks") and the real ("from results") tables, switched by a prop — no markup fork.
- Sensible partial/empty states: pre-tournament shows all teams seeded at zero; mid-group-stage shows points accrued so far.
- Localized in en/es/fr/de.

**Non-Goals:**
- Full FIFA tie-break rules (head-to-head record, disciplinary/fair-play points, drawing of lots). The existing deterministic ordering (points → GD → GF → team name) is reused as a documented approximation.
- Knockout-stage bracket projection or "who qualifies" annotations.
- Any change to competitive scoring, the leaderboard, or the prediction-derived `group-simulation`.
- New persistence — the table is computed on read, stored nowhere.
- New external API calls — this consumes already-synced data.

## Decisions

### Decision: Reuse `simulateGroup`/`simulateAllGroups`, fed by `final` results
A new server loader (`lib/group-table.ts`, server-only) selects group-stage matches for the active competition (`id, home_team, away_team, group_code, home_score, away_score, status`), builds the score map from matches whose `status = 'final'` and whose `home_score`/`away_score` are both non-null, and passes it to `simulateAllGroups`. Scheduled/live/cancelled matches and finals with missing scores contribute nothing, so points only reflect completed games.

*Why:* The engine is already unit-tested and is the same 3/1/0 calculation. A separate copy would risk the two tables diverging. Building the map at the call site is exactly how `group-simulation` already does it.

*Alternative considered:* A Postgres view/RPC computing the table server-side. Rejected — adds a migration and a second source of truth for ordering logic, for no real gain at 12×4 rows computed on read.

### Decision: Dedicated public route `app/[locale]/(public)/standings/page.tsx`
Server component, no auth required (anonymous-visible). Resolves locale + active competition, calls the loader, renders all groups via the generalized component. Add a `loading.tsx` mirroring the existing skeleton conventions. Competitions without a group stage render a friendly empty state rather than 404.

*Why:* User chose a dedicated page. It is public/factual, so unlike `/my-picks` it needs no per-user read and can stay cheap.

*Alternative considered:* Section on `/matches` or the landing page — rejected per the chosen placement.

### Decision: Generalize `GroupStandingsTable` with a `source` variant prop
Add an optional prop (e.g. `source: "picks" | "results"`, default `"picks"`) that selects the caption ("from your picks" vs "from results"), the empty-state copy, and the i18n namespace. Existing call sites (match detail, My Picks) keep current behavior via the default. The real-standings page passes `source="results"` and reads the new `groupStandings` namespace.

*Why:* The table markup, columns, and responsive rules are identical; only copy differs. One component avoids visual drift.

*Alternative considered:* A separate `GroupResultsTable` component — rejected as near-duplicate markup that would need parallel maintenance.

### Decision: Opportunistic freshness on render
Reuse `maybeScheduleOpportunisticSync(matches)` (already used by `/matches`) so visiting `/standings` can trigger a debounced background result sync when a kicked-off match still lacks a result. Render reflects current DB state immediately; the next visit picks up refreshed data.

*Why:* Keeps the real table current without a new cron, matching the existing pattern.

### Decision: Rendering / caching
Render dynamically per request (consistent with `/matches`, which already reads live data). The page reads no cookies/auth beyond locale, so it can later adopt a short `revalidate` if needed; start dynamic for correctness during live matches.

## Risks / Trade-offs

- **Simplified tie-breaks differ from official FIFA ordering** → Documented as a non-goal; ordering stays deterministic and is acceptable for an informational table. Revisit only if users report confusion at decisive standings.
- **Team-name mismatches between ESPN and local fixtures** → The sync layer (`team-name-aliases`) already reconciles names into `matches`; the loader reads local rows, so the table inherits whatever names the matches table holds. No new matching risk introduced.
- **Empty/partial table before/at start of group stage** → Engine seeds every team named in fixtures, so all four rows appear at `played = 0`; copy makes clear the table updates as results come in.
- **No group stage in active competition** → Loader returns `[]`; page shows an empty state instead of erroring.
- **Generalizing the shared component could regress existing call sites** → Default the new prop to today's `"picks"` behavior; existing call sites pass nothing and are unaffected.

## Migration Plan

Additive only — new route, new loader, one new i18n namespace, one nav link, one backward-compatible component prop. No schema or data migration. Rollback = remove the route + nav link; the component prop default leaves existing surfaces untouched.

## Open Questions

- None blocking. (FIFA-accurate tie-breaks deferred to a later change if needed.)
