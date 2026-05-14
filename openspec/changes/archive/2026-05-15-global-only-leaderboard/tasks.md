## 1. Leaderboard page

- [x] 1.1 In `app/(public)/leaderboard/page.tsx`, drop `searchParams`, the `Scope` type, the `todayInTz` helper, the `tz` cookie read, the `TimezoneCookie` import + render, the `leaderboard_for_day` RPC branch, the tab switcher (`ScopeLink`), and the date input form.
- [x] 1.2 Always select from `v_leaderboard_overall` ordered by `rank`.
- [x] 1.3 Rewrite leader card label, header subtitle, empty-state body, and the "not yet ranked" note to use global / overall framing only.
- [x] 1.4 Update the `Metadata` description and OG description to drop "today" / "daily" wording.

## 2. Cleanup

- [x] 2.1 Delete `app/(public)/leaderboard/timezone-cookie.tsx`.
- [x] 2.2 Remove the unused `ScopeLink` component definition from the page file.

## 3. Sibling copy

- [x] 3.1 In `app/page.tsx`, rewrite the leaderboard feature-card subtitle ("Daily and overall leaderboards refresh in real time.") to describe a single overall ranking.
- [x] 3.2 In `app/how-it-works/page.tsx`, retitle the "Daily leaderboard" section (id `04`) to a global framing, rewrite its body copy, and update the page's metadata description accordingly.

## 4. Verification

- [x] 4.1 `pnpm typecheck` — zero errors.
- [x] 4.2 `pnpm lint` — zero errors.
- [x] 4.3 `pnpm test` — all existing tests still green.
- [x] 4.4 `openspec validate global-only-leaderboard` — valid.
- [x] 4.5 Grep: `rg "TimezoneCookie|scope=today|leaderboard_for_day" app components lib` returns no matches in `app/`, `components/`, `lib/` (matches in `lib/database.types.ts` and `lib/db.ts` for the function type alias are allowed since the function stays in the DB).
- [ ] 4.6 Manual: `pnpm dev`, open `/leaderboard`, `/leaderboard?scope=today&date=2026-01-01`, `/leaderboard?scope=overall` — all render the same global table with no tabs or date input.
