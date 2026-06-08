## Context

The app already stores per-user predicted scorelines in `public.predictions` (`home_goals`, `away_goals`, `match_id`, `user_id`) and full fixtures in `public.matches` (`stage`, `group_code` = A–L, `home_team`, `away_team`, plus actual `home_score`/`away_score`/`status`). Competitive scoring (`lib/scoring.ts`, the `scores` table) compares predictions against _actual_ results.

This change is different: it builds a **personal, hypothetical group table** from the user's own predictions — "if my picks all came true, who tops Group A?" — and never touches actual results or other users. There is no existing standings engine; the closest analogue is `lib/scoring.ts`, a pure, unit-tested replica of a scoring rule. We follow that pattern: a pure TS module, DB read-only, no migration.

Constraints: Server Components fetch with the per-request Supabase client (RLS already scopes `predictions` to the caller via `predictions_select_own`); the two surfaces (match detail, My Picks) already run server-side and have `user`/`supabase` in scope.

## Goals / Non-Goals

**Goals:**
- A pure, testable function: given group fixtures + the user's predictions, return ordered group rows (P/W/D/L/GF/GA/GD/Pts/rank).
- Render the relevant single group under the prediction form (match detail) and all twelve groups on My Picks, from one engine + one presentational component.
- Truthful partial tables: only predicted matches count; "played" reflects picks made.
- Zero schema/RLS/migration impact; nothing persisted.

**Non-Goals:**
- Knockout-stage projection / bracket simulation (`stage != 'group'`).
- FIFA head-to-head and disciplinary tie-breakers (chose simplified pts→GD→GF→name).
- Mixing real results into the table, or any cross-user / shared / leaderboard view of the simulation.
- Realtime/optimistic in-form recompute — standings refresh on the next server render after a pick is saved (the form already revalidates).

## Decisions

### D1 — Pure standings engine in `lib/`, mirroring `lib/scoring.ts`
Add `lib/group-standings.ts` exporting something like:
```ts
type GroupTeamRow = {
  team: string; played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDiff: number; points: number; rank: number;
};
function simulateGroup(
  fixtures: { home_team: string; away_team: string }[],
  predictionsByMatch: Map<matchId, { home_goals: number; away_goals: number }>,
  fixtureIds: ...   // pair fixtures with their prediction
): GroupTeamRow[];
```
Signature keyed by `match_id` so a fixture without a prediction is simply absent from the map and skipped. Teams are seeded from the fixtures' distinct `home_team`/`away_team` (so all four teams appear even at played = 0). **Why:** matches the established pattern (pure, no DB, fast to unit-test); keeps ordering/tie-break logic in one place reused by both surfaces. **Alternative considered:** a SQL view / RPC — rejected: adds a migration and RLS surface for a read-only, presentation-only derived value, and is harder to unit-test than pure TS.

### D2 — Standard football points, simplified ordering
Win = 3, draw = 1, loss = 0. Order: points desc → GD desc → GF desc → team name asc (case-insensitive), per the user's choice. **Why:** deterministic, stable, and matches common pool-app expectations without the complexity (and partial-table ambiguity) of FIFA head-to-head. **Trade-off:** can differ from official FIFA ordering when teams are level — acceptable and documented; this is a "what if" toy, not the live bracket.

### D3 — Skip unpredicted matches (no fallback to real/0–0)
A fixture counts only if the user has a prediction. **Why:** keeps the table honestly "yours"; avoids implying the user predicted games they didn't, and avoids mixing actual results into a hypothetical view. **Consequence:** `played` ranges 0–3 per team; the UI must show partial/empty states rather than assume complete groups (covered in spec scenarios).

### D4 — One presentational component, two call sites
Add `components/group-standings-table.tsx` (single group) and a thin all-groups wrapper. Match detail computes one group (filter fixtures to the page match's `group_code`); My Picks computes every group (group fixtures by `group_code`). **Why:** identical rendering, fetched data differs only in breadth. Server Components pass already-computed rows to a client/server presentational component (no client data fetching).

### D5 — Data fetching
- **Match detail** (`stage='group'` only): fetch sibling fixtures `WHERE stage='group' AND group_code = <match.group_code>` and the user's predictions for those `match_id`s. The page already loads the match; add one fixtures query + one predictions query (or reuse existing prediction fetch).
- **My Picks**: fetch all `stage='group'` fixtures, then the user's predictions for those matches (the page already queries the user's predictions — extend the select to cover group fixtures, or run one scoped predictions query). Group fixtures by `group_code` in memory; feed each into `simulateGroup`.

Both rely on existing RLS; no policy changes. Knockout pages skip the section by the `stage` guard.

### D6 — i18n
New `groupSimulation` namespace (heading, column abbreviations P/W/D/L/GF/GA/GD/Pts, "no picks yet" empty state, "see all groups" link) added to `messages/en|es|fr`. Column abbreviations may stay as compact tokens but get accessible labels.

## Risks / Trade-offs

- **Simplified tie-breakers diverge from official FIFA ordering** → Documented as a "what-if from your picks" toy; not used for any real qualification. Engine isolated so FIFA head-to-head can be layered later without touching call sites.
- **Partial tables can confuse ("why played = 1?")** → Empty/partial states are explicit spec scenarios; UI shows played counts and a "no picks yet" state so the cause is visible.
- **Extra queries on two hot pages** → Group-stage fixtures are a small, bounded set (~12 groups × a handful of matches); queries are indexed by `stage`/`group_code` and the predictions read is already RLS-scoped to the user. Negligible.
- **Confusion with friend "groups"** (the app also has friend groups / mini-boards) → Keep naming explicit ("group stage standings" / `group-simulation`) to avoid collision with the social `groups` capability.
- **Drift from `lib/scoring.ts` semantics** → These are deliberately different rules (football points vs. prediction-accuracy points); kept in a separate module with its own tests to prevent conflation.

## Migration Plan

Additive and read-only — no DB migration, no RLS change, no data backfill. Ship engine + tests, then wire the two surfaces. Rollback = remove the component usages; nothing persisted to clean up.

## Open Questions

- Should the match-detail table show a "qualifies (top 2)" marker, or is rank-only enough for v1? (Leaning rank-only; advancement rules for best third-placed teams are out of scope.)
- On My Picks, order the twelve groups by `group_code` A→L (assumed) vs. by the user's completion — A→L assumed for predictability.
