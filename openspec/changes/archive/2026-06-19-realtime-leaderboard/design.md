## Context

`/leaderboard` is server-rendered. `LeaderboardPage` (`app/[locale]/(public)/leaderboard/page.tsx`) calls `createServerSupabaseClient()`, selects `*` from `v_leaderboard_overall` ordered by `rank`, derives `topRows = rows.slice(0, 10)`, and renders the presentational `LeaderboardTable` (`components/leaderboard-table.tsx`, `BoardRow` shape: `user_id`, `display_name`, `total_points`, `exact_hits`, `winner_gd_hits`, `winner_hits`, `rank`). It also computes `myRow`, `leader`, and `players` from the same rows.

`v_leaderboard_overall` is a **view** (latest definition in `supabase/migrations/20260614040000_exclude_admins_from_leaderboards.sql`): it aggregates `public.scores` joined to `matches`/`predictions`/`profiles`, excludes admins inside the aggregate CTE, and ranks with `rank() over (...)`. The ranks, tie-breaks (`exact_hits`, `winner_gd_hits`, `first_submit`), and admin exclusion are non-trivial — recomputing them on the client would duplicate and drift from this SQL.

The base table `public.scores` (`user_id`, `match_id`, `points`, `hit_type`, `computed_at`) is written **only** by the security-definer `compute_match_scores()` during result computation; there are no client insert/update/delete policies. Its RLS select policy is `scores_select_authenticated` — `to authenticated using (true)`. The browser client factory `createBrowserSupabaseClient()` already exists in `lib/supabase/browser.ts`.

## Goals / Non-Goals

**Goals:**
- During a matchday, the on-screen standings update without a manual reload when scores change.
- Reuse `v_leaderboard_overall` as the single source of truth for ranks/ties/admin exclusion — the client never re-derives ranks.
- Keep SSR as the first paint; the realtime layer is additive and degrades gracefully if Realtime never connects.
- Keep `LeaderboardTable` presentational and namespace-agnostic so the per-group mini board that reuses it is unaffected.

**Non-Goals:**
- No client-side rank/tie recomputation, no optimistic UI from prediction events.
- No rank-delta UX ("subiste 3 puestos") — that is bet M3 (`rank-change-notification`), separate.
- No expansion beyond the top 10 already rendered, no search, no segmented/weekly views (bet M10).
- No change to scoring, to `compute_match_scores()`, or to the view definition/RLS.
- No realtime on the per-group board in this change.

## Decisions

- **Subscribe to `public.scores`, not the view.** Supabase Realtime `postgres_changes` operates on base tables in a publication; a view cannot be subscribed to. So the client listens to `public.scores` and treats any event there as "the board may have changed."
- **Migration to add `public.scores` to `supabase_realtime`.** Realtime only emits changes for tables in the `supabase_realtime` publication. A new timestamped migration runs `alter publication supabase_realtime add table public.scores;` (idempotent guard so re-running is safe). This is the one DB change required.
- **Event triggers a re-fetch, not a client recompute.** On any `INSERT`/`UPDATE`/`DELETE` on `public.scores`, the client re-queries `v_leaderboard_overall` (same select + order as SSR) via `createBrowserSupabaseClient()`, then re-slices the top 10 and updates state. This keeps ranks/ties/admin-exclusion authoritative in SQL. A short debounce coalesces the burst of per-user score rows written when one match is computed into a single re-fetch.
- **Thin client wrapper owns the rows.** A new client component (`components/leaderboard-live.tsx`) receives the SSR rows as its initial state, sets up/tears down the channel in an effect, re-fetches on change, and renders `LeaderboardTable` with the live rows. The page passes `initialRows`, `currentUserId`, and the existing `labels`. `LeaderboardTable` stays presentational.
- **Auth-scoped delivery is acceptable.** Realtime `postgres_changes` enforces RLS via the authenticated select policy. Anonymous visitors will not receive change events (the SSR snapshot is what they see); signed-in players — the audience the FOMO loop targets — get live updates. This matches the existing `scores_select_authenticated` policy and needs no RLS change.

## Risks / Trade-offs

- **Realtime must be enabled + publication updated.** If the migration is not applied (or Realtime is disabled for the project), no events arrive; the page silently falls back to the SSR snapshot. Mitigation: ship the migration with the change; the subscription failing is non-fatal by design.
- **Anonymous users get no live updates.** Because `postgres_changes` respects RLS and the scores select policy is `authenticated`-only, signed-out visitors see a static board. Accepted: the SSR snapshot is still correct, and the live loop targets engaged signed-in players. Granting anon select on `scores` is intentionally out of scope.
- **Re-fetch cost during bursts.** Computing one match writes many `scores` rows in quick succession, each an event. A debounce (e.g. ~750ms) collapses them into one `v_leaderboard_overall` re-fetch to avoid hammering the DB. Trade-off: a sub-second delay before the board settles, which is imperceptible.
- **Stale view between event and re-fetch.** The event signals "something changed"; the authoritative numbers come from the subsequent view query, so the displayed state is always a real `v_leaderboard_overall` snapshot, never a client guess.
- **Channel lifecycle.** The effect must `removeChannel` on unmount and avoid duplicate subscriptions across re-renders/locale changes to prevent leaks.
