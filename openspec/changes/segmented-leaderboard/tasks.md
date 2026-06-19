## 1. Database: windowed and per-stage leaderboard functions

- [ ] 1.1 Add a timestamped migration under `supabase/migrations/` (e.g. `<YYYYMMDDHHMMSS>_segmented_leaderboard_functions.sql`) creating `public.leaderboard_for_window(from_ts timestamptz, to_ts timestamptz)`, mirroring the aggregate CTE of `v_leaderboard_overall`/`leaderboard_for_day` (admin-excluded inside `agg`, scoped to `active_competition_id()`), filtered by `m.kickoff_at >= from_ts and m.kickoff_at < to_ts`, returning the same column list (`user_id, display_name, total_points, exact_hits, winner_gd_hits, winner_hits, first_submit, rank`) and tie-breakers.
- [ ] 1.2 In the same migration, create `public.leaderboard_for_stage(stage_key text)` with the identical aggregate, filtered by `m.stage = stage_key` instead of a time window, returning the same columns and tie-breakers.
- [ ] 1.3 `grant execute on function public.leaderboard_for_window(timestamptz, timestamptz) to anon, authenticated;` and the same for `leaderboard_for_stage(text)`, matching `leaderboard_for_day`'s grants.
- [ ] 1.4 Add a rollback comment to the migration (drop both functions) and leave `v_leaderboard_overall` and `leaderboard_for_day` untouched.

## 2. Page: segment parsing and data source branching

- [ ] 2.1 In `app/[locale]/(public)/leaderboard/page.tsx`, accept `searchParams: Promise<{ segment?: string | string[]; stage?: string | string[] }>` and parse `segment` into `overall | week | stage`, defaulting unknown/missing to `overall`.
- [ ] 2.2 Reconcile `stage` against the active competition's stage keys (use the active competition format, as `/matches` does); if `segment=stage` with an invalid/missing `stage`, fall back to `overall` (no redirect, no 404).
- [ ] 2.3 Branch the data source: `overall` → `from("v_leaderboard_overall").select("*").order("rank")` (existing path); `week` → `rpc("leaderboard_for_window", { from_ts, to_ts })`; `stage` → `rpc("leaderboard_for_stage", { stage_key })`. Keep `rows`, `players`, `leader`, `myRow`, and `topRows = rows.slice(0, 10)` derived from the chosen segment's full result.
- [ ] 2.4 Compute the current week's `[from_ts, to_ts)` bounds (Monday-start, in the page's canonical timezone) on the server and pass them as ISO timestamps to the week RPC.

## 3. UI: segment switcher and i18n

- [ ] 3.1 Add a server-rendered segment switcher (Overall / This week / By stage) as `<Link>`s that set `?segment=` (and `?stage=` for the stage option), mirroring the `/matches` filter controls and indicating the active segment.
- [ ] 3.2 Reuse `<LeaderboardTable>` unchanged with the chosen segment's `topRows`; keep the leader card, player count, "your rank" share section, and empty-state branch keyed off the segment's full `rows`.
- [ ] 3.3 Add `leaderboard` namespace strings for the segment labels and stage names (reuse `stageLabel` keys where possible) in `en`, `es`, `fr`, `de`.

## 4. Verification

- [ ] 4.1 Run the project's typecheck and lint; confirm no errors introduced.
- [ ] 4.2 Run the test suite (including `tests/scoring.test.ts`) and add/adjust any leaderboard tests if present; confirm green.
- [ ] 4.3 Manually verify: `/leaderboard` and `/leaderboard?segment=overall` render identical boards; `?segment=week` and `?segment=stage&stage=r16` render restricted boards with the same columns; `?segment=bogus` and `?segment=stage` (no stage) fall back to overall without error; an empty stage shows the empty state.
- [ ] 4.4 Run `openspec validate "segmented-leaderboard"` and confirm it passes.
