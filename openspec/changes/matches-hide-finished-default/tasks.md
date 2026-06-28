## 1. Default the list to non-finished

- [x] 1.1 In `app/[locale]/(public)/matches/page.tsx`, change the default branch of `statusFiltered`: when `statusFilter` is null, filter `scoped` to exclude `statusBucket(m) === "final"` and `=== "cancelled"` (keep scheduled/locked/live)
- [x] 1.2 Leave the explicit `?status=upcoming|live|final` branch unchanged so the Final filter still opts finished matches back in
- [x] 1.3 Confirm `stats` (upcoming/live/final) stays computed from `scoped` (pre-status-filter) so the stat-card counts — including Final — are unchanged
- [x] 1.4 Confirm `isFiltered` is unaffected (default view with no `?status=` still reads as not-filtered, so the first-pick nudge behaves as before)

## 2. All-finished empty state

- [x] 2.1 Add a tailored empty state: when `filtered` is empty, no team/round/picks filter is active, and `stats.final > 0`, render an "all matches finished — view results" state linking to `?status=final` instead of the generic `emptyTitle`/`emptyBody`
- [x] 2.2 Add i18n keys for that state (title + body + CTA, e.g. `allFinishedTitle` / `allFinishedBody` / `allFinishedAction`) to `messages/{en,es,fr,de}.json`, keeping locale parity

## 3. Verification

- [~] DEFERRED (needs rendered matches data; local has none) — 3.1 Default `/matches` (no `?status=`) lists only scheduled/locked/live; no `final`/`cancelled` rows
- [~] DEFERRED (needs rendered matches data; local has none) — 3.2 `?status=final` lists finished matches; `?status=upcoming` / `?status=live` behave as before
- [~] DEFERRED (needs rendered matches data; local has none) — 3.3 Stat cards show true totals (Final count unchanged) in the default view; matchday counts reflect the shown set
- [~] DEFERRED (needs rendered matches data; local has none) — 3.4 When every in-scope match is finished, the default view shows the all-finished empty state (not the generic one) with a working link to the Final filter
- [~] DEFERRED (needs rendered matches data; local has none) — 3.5 Team/round filters compose with the default (e.g. round=r32 default still hides finished r32); first-pick nudge still appears for a signed-in zero-pick user
- [x] 3.6 Run `pnpm typecheck` and `pnpm lint`
- [x] 3.7 Run `openspec validate matches-hide-finished-default --strict` and confirm it passes
