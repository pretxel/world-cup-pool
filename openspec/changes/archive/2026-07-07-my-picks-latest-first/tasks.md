# Tasks: my-picks-latest-first

## 1. Ordering helper

- [x] 1.1 In `lib/picks-order.ts`, flip the comparator to kickoff descending and rename `sortPicksByKickoff` → `sortPicksByKickoffDesc`; map missing/unparseable kickoffs to `-Infinity` so they still sort last; keep the `match_id` ascending tie-break. Update the header comments to describe the descending contract.
- [x] 1.2 Update `tests/picks-order.test.ts` to the new name and assert: latest kickoff first, missing-kickoff picks last, stable `match_id` tie-break on equal kickoffs, input not mutated.

## 2. Page wiring

- [x] 2.1 In `app/[locale]/(app)/my-picks/page.tsx`, update the import and call to `sortPicksByKickoffDesc` and reword the ordering comment (pages partition one global kickoff-descending order; page 1 = latest picks).

## 3. Verify

- [x] 3.1 Run the unit tests and lint/typecheck; confirm green.
- [ ] 3.2 Manually load `/my-picks` with a multi-page pick set: page 1 shows the newest fixtures, last page shows the tournament openers, stats and group simulation unchanged across pages.
