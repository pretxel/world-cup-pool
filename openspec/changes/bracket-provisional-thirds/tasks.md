## 1. Provisional best-third resolution

- [ ] 1.1 In `lib/bracket-core.ts`, replace `qualifyingThirdGroups(ctx)` with one returning `{ groups: string[]; provisional: boolean } | null`: gather groups with a results-backed third (`ctx.hasResults` + `rows[2]`); require all groups represented and ≥8; sort by `compareTeamRows`; take top-8 letters; `provisional = !ctx.allGroupsComplete`; return `null` when not every group has a result.
- [ ] 1.2 In `buildBracket`, derive `thirdAlloc` from the returned `groups` and keep the `provisional` flag; in `case "third"`, when a group resolves, set the participant status to `provisional` (set-level flag) or `confirmed` (all complete) instead of always `confirmed`. Placeholder behavior when `thirdAlloc` is null is unchanged.

## 2. Tests

- [ ] 2.1 Extend `tests/bracket-third-allocation.test.ts` (or `bracket-core`): (a) all-complete still resolves + marked confirmed; (b) every-group-has-a-result-but-not-complete resolves the same allocation marked provisional; (c) at least one group with no result → third slots stay placeholder; (d) changing standings changes which group fills a slot.

## 3. Verification

- [ ] 3.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; fix failures.
- [ ] 3.2 Manually verify on `/bracket` against seeded data: with all 12 groups having results, the `3rd …` slots show provisional teams (provisional styling); with a group still at zero results, they stay placeholders.
