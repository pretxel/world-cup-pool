## 1. Page-math helper (pure, testable)

- [x] 1.1 Add `lib/pagination.ts` with `PAGE_SIZE` and `paginate(totalItems, requestedPage, pageSize)` → `{ page, totalPages, start, end }`, clamping page to 1…totalPages (totalPages ≥ 1)
- [x] 1.2 Parse helper for the raw query value (string | string[] | undefined → integer, NaN/≤0 → 1)

## 2. Helper unit tests

- [x] 2.1 Add `tests/pagination.test.ts`: multi-page split (12 items, size 5 → 3 pages; page 1 start/end = 0/5)
- [x] 2.2 Clamp above range (page 99, 3 pages → page 3) and below/invalid (0, -4, "abc" → page 1)
- [x] 2.3 Edge sizes: exact multiple (10 → 2 pages), single partial page (3 → 1 page), zero items (→ totalPages 1, empty slice)

## 3. Pagination control

- [x] 3.1 Add a control (component or inline in the page) rendering "Page X of Y" + previous/next `?page=` links, disabled at bounds, returning null when `totalPages <= 1`

## 4. i18n

- [x] 4.1 Add pagination keys to `myPicks` in `messages/en.json` (`pagePosition` = "Page {current} of {total}", `prevPage`, `nextPage` + aria labels)
- [x] 4.2 Mirror keys in `messages/es.json` and `messages/fr.json`

## 5. Wire My Picks page

- [x] 5.1 Add `searchParams: Promise<{ page?: string }>` to the page; parse + `paginate` over the full `picks` array
- [x] 5.2 Render only `picks.slice(start, end)` in the list; keep header stats and `simulateAllGroups` reading the full set
- [x] 5.3 Render the pagination control below the list (not shown in the empty state)

## 6. Verification

- [x] 6.1 `pnpm test` green (incl. new pagination tests)
- [x] 6.2 `pnpm typecheck` + `pnpm lint` clean
- [x] 6.3 `pnpm build` succeeds
- [x] 6.4 Manual: 12 picks → 3 pages of 5/5/2; `?page=99` clamps to last; `?page=0`/`abc` → page 1; stats + group sim constant across pages; ≤5 picks → no controls
- [x] 6.5 `openspec validate my-picks-pagination --strict` passes
