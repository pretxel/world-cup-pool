## 1. Order the gallery by match date

- [x] 1.1 In `components/recent-recap-images.tsx`, fetch completed renders without the `created_at` pre-limit (keep a safety `limit`, e.g. 200) and add `kickoff_at` to the `matches` select.
- [x] 1.2 Join renders to matches, sort items by match `kickoff_at` descending (tie-break: render `created_at` desc, then match id), and take the first 5; render in that order. Keep RLS sourcing, links, alt text, and the hidden-when-empty behavior.

## 2. Verification

- [x] 2.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; fix any failures.
- [x] 2.2 Manually verify the landing gallery shows the comics for the 5 matches with the most recent kickoff dates, most-recent match first, each linking to its match; gallery stays hidden when there are none.
