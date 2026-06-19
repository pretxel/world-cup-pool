## Why

The global leaderboard at `/leaderboard` is server-rendered once per request: `LeaderboardPage` queries `v_leaderboard_overall` on the server, slices the top 10 (`topRows = rows.slice(0, 10)` in `leaderboard/page.tsx`), and hands the rows to the presentational `LeaderboardTable`. During a matchday, scores are recomputed as results land (`compute_match_scores()` writes `public.scores`), but a player staring at the standings sees nothing change until they manually reload. That kills the FOMO that makes a live ranking compelling — there is no reason to leave the page open while goals are scored. This is medium bet **M2** in `análisis.md` ("Leaderboard en tiempo real (Supabase Realtime sobre `v_leaderboard_overall`)"): give the board a heartbeat so ranks shift in front of the player during jornadas, turning a static page into an ambient reason to stay.

## What Changes

- Add a client-side Supabase Realtime subscription to the leaderboard so the standings re-render live when scores change, with no manual reload.
- Because `v_leaderboard_overall` is a Postgres view, it cannot be subscribed to directly; Realtime listens to row changes on the underlying base table `public.scores`. A migration adds `public.scores` to the `supabase_realtime` publication so `postgres_changes` events are emitted.
- On any `INSERT`/`UPDATE`/`DELETE` event on `public.scores`, the client re-fetches `v_leaderboard_overall` (the source of truth for ranks, ties, and admin exclusion) via the browser Supabase client and recomputes the rendered standings — it does not try to re-derive ranks on the client.
- The SSR render stays as the first paint (no behavior change for the initial load); the realtime layer is additive and degrades gracefully if the channel never connects (the page is exactly what it is today).
- The shared `LeaderboardTable` stays presentational and namespace-agnostic; the live wiring lives in a thin client component that owns the rows state and passes them to `LeaderboardTable`.

## Capabilities

### New Capabilities
- `realtime-leaderboard`: a live-updating global leaderboard that subscribes to score changes via Supabase Realtime and re-fetches `v_leaderboard_overall` to keep the on-screen standings current during matchdays without a page reload.

### Modified Capabilities

## Impact

- Code: `app/[locale]/(public)/leaderboard/page.tsx` — pass the SSR rows into a new client wrapper that renders `LeaderboardTable` and owns the live subscription; keep SSR as the initial state.
- Components: new client component (e.g. `components/leaderboard-live.tsx`) that uses `createBrowserSupabaseClient()` from `lib/supabase/browser.ts`, subscribes to `postgres_changes` on `public.scores`, re-fetches `v_leaderboard_overall`, and feeds `LeaderboardTable`. `components/leaderboard-table.tsx` stays presentational (unchanged or only typed to accept the same `BoardRow[]`).
- Data: new migration under `supabase/migrations/` adding `public.scores` to the `supabase_realtime` publication. No schema, view, or RLS change — `scores_select_authenticated` (`to authenticated using (true)`) already governs who receives change events.
- Realtime: requires Supabase Realtime to be enabled for the project and the publication to include `public.scores`.
- No new dependency (`@supabase/ssr` / `supabase-js` already in use), no API change, no breaking change.
