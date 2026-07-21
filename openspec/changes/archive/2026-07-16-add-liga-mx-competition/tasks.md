## 1. Format and database contract

- [ ] 1.1 Extend `lib/competition-schema.ts` stage schemas and helpers for `pointMultiplier`, `seedsFromStage`, `reseedFromStage`, and `twoLegged`, including cross-stage validation and client-safe type exports.
- [ ] 1.2 Add an additive migration for nullable-together `matches.tie_key` and `matches.leg`, second-leg tie outcome fields (`tie_winner_team` and decision), CHECK constraints for valid combinations, and a partial unique index on `(competition_id, tie_key, leg)` where `tie_key` is not null.
- [ ] 1.3 Update `validate_format_config` to mirror the shared schema, preserving World Cup compatibility; add SQL tests for accepted and rejected Liga MX declarations.
- [ ] 1.4 Extend generated/hand-written database types and all match query/select shapes that need tie metadata.
- [ ] 1.5 Add a validated admin-managed official-seeding override source for a completed league stage; use it only when remaining Liga MX regulation tiebreakers cannot be derived from match rows.

## 2. Standings and Liguilla resolution

- [ ] 2.1 Add a pure league-table builder alongside the existing group standings logic, including final-match filtering, standings totals, match-derived Liga MX tiebreakers, official-seeding override handling, and confirmed/provisional seeding output.
- [ ] 2.2 Extend `lib/bracket-core.ts` slot parsing and resolution for `Seed N`, `Winner Tie <tie_key>`, and `Seeded Winner <stage> <position>` while preserving existing World Cup bracket behavior.
- [ ] 2.3 Implement aggregate tie resolution from `tie_key`/`leg`, including the configured regular-season-seed tiebreak, reseeded source-stage winners, and recorded Final extra-time/penalty outcomes.
- [ ] 2.4 Extend `computeKnockoutTeamUpdates` and its server loader to pass competition format plus tie metadata, then confirm only fully-resolved Liga MX participants.
- [ ] 2.5 Update the public playoff bracket and match surfaces to render leg number, tie context, aggregate score/status, and unresolved placeholders accessibly.

## 3. Competition-specific scoring

- [ ] 3.1 Resolve each match multiplier from its competition format in `public.compute_match_scores`, retaining the current World Cup mapping as the fallback.
- [ ] 3.2 Update `lib/scoring.ts` and the scoring explainer to use the active competition format with the same fallback semantics as SQL.
- [ ] 3.3 Add SQL and TypeScript parity tests across regular, Quarterfinal, Semifinal, and Final Liga MX matches, plus existing World Cup regression cases.

## 4. Liga MX seed data and admin support

- [ ] 4.1 Confirm the authoritative Apertura 2026 regulations, clubs, fixture dates, kickoff times, and venues before committing seed data; smoke-test the existing Football-Data token against Liga MX `LMX` and retain ESPN `mex.1` as the fallback.
- [ ] 4.2 Add a forward-only migration that seeds the inactive `liga-mx-apertura-2026` competition, its validated format/branding/provider config (`LMX` / `mex.1`), the official 153 regular-season fixtures, and the 14-leg Liguilla placeholder skeleton with tie keys and legs.
- [ ] 4.3 Extend the admin competition format editor and fixture editor for the new stage fields and tie/leg metadata, keeping invalid combinations unrepresentable where practical.
- [ ] 4.4 Confirm the existing sync path scopes provider requests and deduplication correctly for Liga MX; document the ESPN fallback and manual admin-result recovery path.

## 5. Tests and rollout

- [ ] 5.1 Unit-test league standings: incomplete-season provisional behavior, goal-difference, visitor-goal, and head-to-head ties; require an official override when remaining non-match criteria decide the seed.
- [ ] 5.2 Unit-test Liguilla resolution: direct Quarterfinal pairings, semifinal reseeding after upset paths, aggregate winner, Quarterfinal/Semifinal seed tiebreak, Final penalty outcome, incomplete legs, and World Cup regression fixtures.
- [ ] 5.3 Add UI/action tests for confirmed participant visibility and per-leg prediction availability; run focused tests, typecheck, lint, and the complete test suite.
- [ ] 5.4 Apply and verify the migration through the documented manual pooler process in a non-production environment, reload PostgREST, then keep the competition inactive pending explicit activation approval.
