## Why

The public `/leaderboard` renders a single all-time ranking sourced from `v_leaderboard_overall` (capped to the top 10 by `topRows = rows.slice(0, 10)` in `leaderboard/page.tsx`). For a mid-table player the all-time board is effectively frozen: the leaders accumulated their lead over the whole tournament and the gap is unreachable, so there is no fresh reason to return. This is engagement bet **M10** from `análisis.md` ("Apuestas medianas" / section 5.B "Competitivo"): a leaderboard segmented by **this week** and **by tournament stage** gives mid-tier players a short-horizon, reachable competition that resets as the tournament progresses.

The data already exists. `scores` join to `matches`, and `matches` carry `kickoff_at` (timestamptz) and `stage` (one of `group`, `r32`, `r16`, `qf`, `sf`, `third`, `final`, validated per-competition). The existing `leaderboard_for_day(d date, tz text)` function already proves the pattern of filtering the same aggregate by a `matches.kickoff_at` window. We extend that pattern to a week window and to a stage filter, and surface the choice through a URL-driven segment switch mirroring the ephemeral `searchParams` filters on `/matches` (`?team=`, `?status=`, `?picks=`).

## What Changes

- Add a URL-driven **segment switch** to `/leaderboard` via `?segment=` with three values: `overall` (default, unchanged behavior), `week` (current calendar week), and `stage` (a single tournament stage chosen via `?stage=<key>`).
- Add a SQL function `leaderboard_for_window(from_ts timestamptz, to_ts timestamptz)` and a SQL function `leaderboard_for_stage(stage_key text)` that aggregate the **same** score columns as `v_leaderboard_overall` (`total_points`, `exact_hits`, `winner_gd_hits`, `winner_hits`, `rank`) but restricted by a `matches.kickoff_at` window / `matches.stage` value, both scoped to `active_competition_id()` and excluding admins, exactly as the existing leaderboard objects do.
- The page picks the data source from `?segment=`: `overall` reads `v_leaderboard_overall` (today's code path, untouched), `week` calls `leaderboard_for_window` with the current week's bounds, `stage` calls `leaderboard_for_stage`. The returned row shape is identical to `BoardRow`, so `LeaderboardTable`, the top-10 cap, the leader card, the player count, and the "your rank" share section all work unchanged.
- Unknown / missing param values fall back to `overall` (no redirect, no 404), matching the lenient param handling already used on `/matches` and the stale-URL tolerance documented in the `leaderboard` spec.

## Capabilities

### New Capabilities
- `segmented-leaderboard`: the public `/leaderboard` exposes overall, this-week, and by-stage segments selected through `?segment=` (and `?stage=` for the stage segment), each ranking the active competition's non-admin players over the segment's matches using the same scoring columns and tie-breakers as the overall board.

### Modified Capabilities

## Impact

- Code: `app/[locale]/(public)/leaderboard/page.tsx` — read `?segment=` / `?stage=` from `searchParams`, branch the data source, render a segment switcher; the existing `topRows`/`leader`/`myRow`/share logic stays.
- Components: new segment-switch control (links that set `?segment=`/`?stage=`, mirroring the `/matches` filter controls); `components/leaderboard-table.tsx` unchanged (it renders whatever rows it is handed).
- Data: new migration under `supabase/migrations/` adding `leaderboard_for_window` and `leaderboard_for_stage`; `v_leaderboard_overall` and `leaderboard_for_day` are unchanged.
- i18n: new strings for the segment labels (Overall / This week / By stage) and stage names in the existing `leaderboard` namespace across en, es, fr, de.
- No new dependency, cron, or Realtime requirement; rendering stays SSR like the current page.
