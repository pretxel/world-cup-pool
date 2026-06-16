## 1. Ordering helper

- [x] 1.1 Add a pure helper `sortPicksByKickoff(picks)` in `lib/picks-order.ts` that returns a new array sorted by the embedded match's `kickoff_at` ascending; define a minimal input type (the fields it reads: `match_id` and `matches.kickoff_at`) so it is type-checked without an `as any`
- [x] 1.2 Make the comparator total and deterministic: break kickoff ties with `match_id` ascending, and sort invalid/missing `kickoff_at` last; do not mutate the input array

## 2. Wire into the My Picks page

- [x] 2.1 In `app/[locale]/(app)/my-picks/page.tsx`, remove the ineffective `.order("kickoff_at", { foreignTable: "matches", ascending: true })` from the predictions query (it sorts the embedded row, not the predictions)
- [x] 2.2 Apply `sortPicksByKickoff(picks ?? [])` to produce `allPicks` before `paginate(...)`/`slice(...)`, so pages partition one global kickoff-ascending order; leave header stats, the `predictionsByMatchId` map, and the group simulation reading the same full set
- [x] 2.3 Confirm the row render still reads `kickoff_at` from the embedded match and that no other call site depended on the previous (arbitrary) order

## 3. Tests

- [x] 3.1 Add `tests/picks-order.test.ts` for `sortPicksByKickoff`: orders earliest-kickoff first across multiple dates; is stable/deterministic for equal kickoffs (tiebreak by `match_id`); places missing/invalid `kickoff_at` last; returns a new array and does not mutate the input
- [x] 3.2 Add a case asserting the global-order property used by pagination: concatenating successive 5-item windows of the sorted set yields a non-decreasing kickoff sequence

## 4. Verification

- [x] 4.1 Run `npm run lint`, `npm run typecheck`, and `npm run test` and confirm green (including existing `pagination` suite)
- [x] 4.2 Validate the change: `openspec validate order-picks-by-match-date --strict`
