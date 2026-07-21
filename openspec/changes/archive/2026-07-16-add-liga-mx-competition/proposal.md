# Add Liga MX competition (Apertura 2026)

## Why

The pool platform is generically registered around `competitions`, but the capabilities that make a competition playable — standings, knockout resolution, and stage-weighted scoring — still assume the World Cup shape: groups followed by a single-leg, fixed bracket with stages named `group/r32/.../final`.

Liga MX Apertura 2026 breaks those assumptions. Its 18-team, 17-round single-table regular season feeds a Liguilla in which the top eight qualify directly for two-legged Quarterfinals, Semifinals, and Final. Semifinals are reseeded from the final regular-season positions; a tied Quarterfinal or Semifinal aggregate advances the higher seed without away goals, while a tied Final is decided by extra time and penalties. A registry row alone would therefore yield an unplayable pool: no final league seeding, unresolved Liguilla participants, and playoff picks scored at the default multiplier.

This change adds those format capabilities and seeds Liga MX Apertura 2026 as a first-class, fully scored pool.

## What Changes

- Introduce **league-phase standings**: a single-table computation for a `league`-kind stage, applying all match-derived Liga MX tiebreakers and accepting an official final-seeding override when non-match criteria decide the order.
- Introduce a **Liguilla format**: direct top-eight qualification, two-legged aggregate Quarterfinals/Semifinals/Final, semifinal reseeding, higher-seed Quarterfinal/Semifinal tiebreaks, and an explicit Final winner for extra-time/penalty decisions. Predictions and scores remain per individual leg.
- Seed **Liga MX Apertura 2026** (`liga-mx-apertura-2026`) inactive, with its official 153-match regular-season schedule, a 14-leg Liguilla skeleton, competition branding, and result-provider configuration (`footballData: LMX/2026`, ESPN `mex.1`).
- **Modify `competition-format`**: validate stage declarations for two-legged ties, league seeding sources, and a knockout stage reseeded from an earlier knockout stage.
- **Modify `stage-weighted-scoring`**: resolve multipliers from the competition format so Liga MX uses `regular ×1`, `qf ×6`, `sf ×8`, and `final ×10`.
- **Modify `knockout-team-autofill`**: resolve participants from confirmed league seeds, reseeded prior-round winners, and aggregate results as well as the existing group/single-match sources.

## Capabilities

### New Capabilities
- `league-phase-standings`: single-table standings for a `league` stage, including confirmed downstream seeding.
- `liguilla-format`: direct top-eight, two-legged Liga MX playoffs with reseeded Semifinals and aggregate-tie seed tiebreaks.
- `liga-mx-competition`: the seeded Apertura 2026 registry row, schedule, Liguilla skeleton, provider config, and branding.

### Modified Capabilities
- `competition-format`: format stages support and validate two-legged, league-seeded, and reseeded-knockout declarations.
- `stage-weighted-scoring`: multiplier resolution is competition-scoped, with existing World Cup behavior as the fallback.
- `knockout-team-autofill`: confirmed participants can derive from league standings, reseeded winners, and aggregate ties.

## Impact

- **Database**: additive tie linkage/outcome fields on `matches`, a final league-seeding override source, stricter `format_config` validation, competition-aware scoring, one inactive competition row, 153 regular-season fixtures, and 14 Liguilla legs.
- **Domain**: league-table, aggregate-tie, and reseeded slot resolution in `lib/group-standings.ts`, `lib/bracket-core.ts`, and `lib/bracket.ts`; corresponding scoring and admin confirmation support.
- **UI**: a seeded two-leg Liguilla, format-editor controls, and match/list detail context for leg and aggregate status.
- **Ingestion**: the official Liga MX Apertura 2026 calendar is the fixture seed source; live results use Football-Data when the configured token has Tier 3 access, then the existing keyless ESPN fallback, with admin score entry as the final fallback.
- **Compatibility**: all new declarations are opt-in, leaving the World Cup format, brackets, and multipliers unchanged.
