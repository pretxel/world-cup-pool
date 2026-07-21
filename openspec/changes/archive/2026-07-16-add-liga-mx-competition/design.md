# Design — Add Liga MX competition (Apertura 2026)

## Context

The `competitions` registry already permits an operator to create a competition row with a `format_config`, but playable-pool code is still World-Cup-specific:

- `lib/bracket-core.ts` resolves group standings and single-match winners only.
- `lib/group-standings.ts` partitions all tables by `group_code`.
- `lib/scoring.ts` and `compute_match_scores` use a global map of World Cup stage names.
- `matches` has no relationship between legs of one aggregate tie.

Liga MX Apertura 2026 has an 18-team, 17-round single round-robin regular season (153 matches). The top eight enter a 14-leg Liguilla: two-legged Quarterfinals, reseeded two-legged Semifinals, and a two-legged Final. A tied Quarterfinal or Semifinal aggregate advances the team with the better final regular-season position; away goals do not apply. A tied Final proceeds to extra time and then penalties. Each leg remains an independently predicted and scored match.

The official [Apertura 2026 calendar](https://d1ezr1jf3kzw59.cloudfront.net/docs/publicaciones/ligamx/2026-2027/1/calendario-liga-mx-torneo-apertura-2026.pdf) is the regular-season seed source. Production migrations are applied manually via the pooler; deploys do not run them and `db push` is unsafe.

## Goals / Non-Goals

**Goals:**
- Represent and resolve league seeding, two-legged aggregate ties, and reseeded knockout rounds from `format_config`.
- Score Liga MX matches with competition-scoped stage weights.
- Seed a fully-defined, inactive competition that is playable as soon as it is explicitly activated.

**Non-Goals:**
- Build a new third-party results provider.
- Change base scoring (5/3/1/0) or the per-leg prediction model.
- Add a separate result provider or model player-level disciplinary events.
- Activate Liga MX in production.

## Decisions

### 1. Two-legged ties use `tie_key` + `leg` on `matches`

Add nullable-together `tie_key text` and `leg smallint` columns. When populated, both legs share `tie_key` and `leg` is 1 or 2. A partial unique index permits one `(competition_id, tie_key, leg)` row. Add nullable `tie_winner_team` and `tie_decision` (`aggregate|higher_seed|extra_time|penalties`) on the second leg to record an official winner when the score alone cannot determine it. The bracket resolver aggregates matching legs and accepts the explicit outcome only when needed.

This keeps predictions and score rows per game, avoids joins in existing match reads, and leaves World Cup rows unchanged. A normalized series table is rejected because it adds joins without improving the core prediction model.

### 2. League standings extend the existing table builder

Add a league-table mode beside group standings. It ranks every team appearing in a `league` stage with `group_code = NULL`, counting final matches only. It applies the match-derived Liga MX order: points, goal difference, goals for, away goals, then head-to-head. If the remaining regulation criteria require coefficient or Fair Play data unavailable from matches, the resolver requires an admin-entered official final seeding rather than silently applying an invented deterministic order. Once all fixtures are final and the order is fully derived or overridden, it emits a confirmed `seed → team` map; before that it remains provisional and cannot populate downstream fixtures.

### 3. The pure resolver gains league, aggregate, and reseeded slots

Extend `ParsedSlot` and `bracket-core.ts` with:

- `{ kind: "seed"; position }` for placeholders such as `Seed 1` and `Seed 8`.
- `{ kind: "winner-tie"; tieKey }` for a completed aggregate tie, with its configured regular-season seed source breaking a tied Quarterfinal or Semifinal aggregate and an explicit official outcome resolving a tied Final.
- `{ kind: "seeded-winner"; stage; position }` for placeholders such as `Seeded Winner qf 1`. It resolves only after every tie in the source stage is final and orders the winners by their regular-season seeds.

Quarterfinals use `Seed 1` v `Seed 8`, `Seed 2` v `Seed 7`, `Seed 3` v `Seed 6`, and `Seed 4` v `Seed 5`. Semifinals use seeded Quarterfinal winners 1 v 4 and 2 v 3, so upset paths remain correct. The resolver stays pure and DB-free; the server loader supplies the competition format, fixtures, and completed standings.

### 4. Stage multipliers live in `format_config`

An optional `pointMultiplier` on each stage is read by both `compute_match_scores` and `lib/scoring.ts`. When absent, current World Cup `STAGE_POINT_MULTIPLIER` behavior, including the unknown-stage `×1` fallback, is unchanged. Liga MX declares `regular ×1`, `qf ×6`, `sf ×8`, and `final ×10`.

This keeps the multiplier data-driven and lets the scoring explainer derive active-competition values without duplicated constants.

### 5. Seed fixtures as data; use the existing configured providers

Seed the official 153 regular-season fixtures and the 14-leg Liguilla skeleton with placeholders, tie keys, and legs. Set `providers` to `{ footballData: { code: 'LMX', season: '2026' }, espn: { leaguePath: 'mex.1' } }`. The existing sync pipeline already reads those per-competition values: Football-Data is the primary source when the token includes its Tier 3 Liga MX coverage; ESPN is the keyless fallback. Admin score entry remains the manual recovery path. No provider integration is added by this change.

## Risks / Trade-offs

- **Tie metadata touches a hot table** → Nullable-together fields and a partial index keep World Cup reads unchanged.
- **Semifinal reseeding is subtle** → Seed direct QF pairings plus `Seeded Winner qf` slots, and cover multiple upset paths in pure unit tests.
- **SQL and TypeScript scoring could drift** → Both resolve the same `format_config` field and share parity tests across every Liga MX stage.
- **Late standings tiebreakers require data not present in match rows** → Test all match-derived criteria and require a validated official-seeding override where coefficient/Fair Play data decides the order.
- **The existing Football-Data token may not include Tier 3** → The configured ESPN `mex.1` fallback is keyless; retain admin score entry as a manual recovery path.

## Migration Plan

1. Ship one additive migration: nullable-together tie linkage/outcome fields and index; a validated official-seeding override source; extended format validation; competition-scoped score multiplier; inactive competition, official regular-season fixtures, and Liguilla skeleton.
2. Apply manually via pooler `psql`, record the change, and issue the documented PostgREST reload.
3. Leave the competition inactive; later activation remains confirmation-gated through `set_active_competition`.
4. Roll back before predictions by deleting the inactive seed rows; added columns are nullable no-ops for World Cup data.

## Open Questions

- Smoke-test the existing Football-Data token against `LMX` before relying on it; ESPN `mex.1` is the confirmed keyless fallback.
- Confirm postseason kickoff times when Liga MX publishes them; the current official calendar supplies the regular season.
- Reconfirm the 2026-27 regulations before applying the migration, especially official seeding after coefficient/Fair Play tiebreaks and Final extra-time/penalty handling.
