## 1. Cap the gallery at 5

- [x] 1.1 In `components/recent-recap-images.tsx`, change `MAX_ITEMS` from 8 to 5.
- [x] 1.2 Update the grid to a clean 5-up on large screens (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`).

## 2. Verification

- [x] 2.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; fix any failures.
- [x] 2.2 Manually verify the landing page shows at most the 5 newest completed recap images, newest first, each linking to its match; gallery stays hidden when there are none.
