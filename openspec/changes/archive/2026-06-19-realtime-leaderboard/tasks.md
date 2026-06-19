## 1. Database: Realtime publication

- [x] 1.1 Create a timestamped migration under `supabase/migrations/` (e.g. `<timestamp>_scores_realtime_publication.sql`) that adds `public.scores` to the `supabase_realtime` publication.
- [x] 1.2 Make the migration idempotent: guard the `alter publication supabase_realtime add table public.scores;` so re-running against a DB where the table is already a member does not error.
- [x] 1.3 Document in the migration header that the leaderboard is a view (`v_leaderboard_overall`) and Realtime must listen on the `public.scores` base table; note no schema/RLS change is made.
- [x] 1.4 Confirm `scores_select_authenticated` (`to authenticated using (true)`) already governs who receives change events — no new RLS policy is added.

## 2. Live leaderboard client component

- [x] 2.1 Add a client component (e.g. `components/leaderboard-live.tsx`) that accepts `initialRows: BoardRow[]`, `currentUserId`, and the existing `labels`, holds rows in state seeded from `initialRows`, and renders `LeaderboardTable`.
- [x] 2.2 In an effect, create a browser client via `createBrowserSupabaseClient()` and subscribe to a `postgres_changes` channel on `public.scores` (INSERT/UPDATE/DELETE).
- [x] 2.3 On a change event, re-fetch `v_leaderboard_overall` (same select + `order("rank")` as SSR), re-slice the top 10, and update state; never re-derive ranks on the client.
- [x] 2.4 Debounce the re-fetch (e.g. ~750ms) so a burst of per-user score rows from one computed match collapses into a single view query.
- [x] 2.5 Remove the channel on unmount and guard against duplicate subscriptions across re-renders/locale changes.
- [x] 2.6 Fall back silently to `initialRows` if the channel never connects or a re-fetch errors (no user-facing error).

## 3. Wire the page

- [x] 3.1 In `app/[locale]/(public)/leaderboard/page.tsx`, render the live wrapper for the standings, passing the SSR `topRows` as `initialRows`, `user?.id`, and the existing `labels`.
- [x] 3.2 Keep the SSR query, empty-state branch, leader card, share section, and CTA blocks unchanged (SSR is the first paint).
- [x] 3.3 Keep `components/leaderboard-table.tsx` presentational — unchanged, or only typed to accept the same `BoardRow[]`.

## 4. Verification

- [x] 4.1 Run typecheck and lint; fix any issues.
- [x] 4.2 Run the test suite.
- [x] 4.3 Run `openspec validate "realtime-leaderboard"` and confirm it passes.
- [x] 4.4 Manual check: with the migration applied, open `/leaderboard` as a signed-in user, write/recompute a score, and confirm the standings update live without reload; confirm a signed-out visitor still sees the SSR snapshot with no error.
