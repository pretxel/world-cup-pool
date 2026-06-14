## 1. Cap the standings table at the top 10

- [x] 1.1 In `app/[locale]/(public)/leaderboard/page.tsx`, derive `const topRows = rows.slice(0, 10)` after `rows` is built, keeping `players`, `leader`, and `myRow` computed from the full `rows`.
- [x] 1.2 Pass `topRows` (not `rows`) to `<LeaderboardTable rows={...} />`; leave the `currentUserId` and `labels` props unchanged.
- [x] 1.3 Confirm the empty-state branch still keys off the full array (`rows.length === 0`), not `topRows`, so it triggers correctly.

## 2. Verify behavior

- [x] 2.1 With more than 10 ranked players, confirm the table renders exactly 10 rows (ranks 1–10) and the leader stat still reports the full count.
- [x] 2.2 Signed in as a user ranked 11th or lower, confirm they are absent from the table but the "share your rank" section still shows their actual rank and points.
- [x] 2.3 With 10 or fewer players, confirm all players render and the empty state is unaffected.
- [x] 2.4 Run `openspec verify --change leaderboard-top-10` (or `/opsx:verify`) and the project's typecheck/lint to confirm no regressions.
