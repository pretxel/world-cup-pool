## Context

`/leaderboard` (`app/[locale]/(public)/leaderboard/page.tsx`) is an SSR page that selects all rows from the `v_leaderboard_overall` view ordered by `rank`, derives `players` (count), `leader` (rank 1), `myRow` (the signed-in user's row), and `topRows = rows.slice(0, 10)`, then hands `topRows` to the presentational `LeaderboardTable` (`components/leaderboard-table.tsx`). The table's `BoardRow` shape is `{ user_id, display_name, total_points, exact_hits, winner_gd_hits, winner_hits, rank }`.

Three database objects already define the ranking algebra, all scoped to `active_competition_id()` and all excluding admins inside the aggregate CTE (so ranks stay contiguous):
- `v_leaderboard_overall` — all-time aggregate of `scores` joined to `matches` and `predictions`.
- `leaderboard_for_day(d date, tz text)` — the same aggregate filtered to a single local day via a `kickoff_at >= day_start_utc and kickoff_at < day_end_utc` window. It already demonstrates exactly the windowing this change generalizes.
- `v_quiz_leaderboard` — sibling pattern, out of scope.

Scoring is fixed (`lib/scoring.ts` / SQL `compute_match_scores`): 5 / 3 / 1 / 0 for exact / winner+GD / winner / miss, and `scores` rows already carry `points` and `hit_type`. Tie-breakers in every board are `total_points desc, exact_hits desc, winner_gd_hits desc, first_submit asc`.

Stages are `matches.stage` keys `group, r32, r16, qf, sf, third, final`, validated per-competition by the `trg_matches_validate_competition` trigger; `stageLabel()` in `lib/match-utils.ts` maps a key to an English label. URL-driven, ephemeral filters are an established pattern on `/matches` (`?team=`, `?status=`, `?picks=`), where unknown values are silently dropped to "show everything".

Repo facts already established (not part of this change, noted to avoid re-proposing them): prod email works (`EMAIL_FROM=no-reply@edselserrano.com`, domain verified); `profiles` now has `email_prefs` (jsonb) and `welcome_email_sent_at`; the quick-win analytics / nudge changes have shipped.

## Goals / Non-Goals

**Goals:**
- Let a visitor switch the `/leaderboard` between **overall**, **this week**, and **a single tournament stage** via the URL, with `overall` as the default and the current code path unchanged.
- Reuse the exact scoring columns, tie-breakers, competition scope, and admin exclusion of `v_leaderboard_overall`, so every segment is internally consistent and `LeaderboardTable` is reused verbatim.
- Keep the existing top-10 cap, leader card, player count, and "your rank" share section working for every segment, computed from that segment's full ranked field.
- Be lenient with the URL: bad/missing `segment` or `stage` falls back to `overall` (no redirect, no 404).

**Non-Goals:**
- No realtime updates (that is bet M2 `realtime-leaderboard`); the page stays SSR.
- No rank-delta / "you moved up" badges (bet M3 `rank-change-notification`).
- No group mini-board segmentation, no per-user share/rank page changes, no quiz-leaderboard changes.
- No new scoring rules, no historization tables, no schedule-based "week N" naming beyond the current calendar week.

## Decisions

- **Two SQL functions, not a parameterized view.** A view cannot take a date range or a stage argument; the existing codebase already chose a SQL function (`leaderboard_for_day`) for windowed ranking. We follow it: `leaderboard_for_window(from_ts timestamptz, to_ts timestamptz)` for the week segment and `leaderboard_for_stage(stage_key text)` for the stage segment. Both return the identical column list and use the identical aggregate CTE (admin-excluded, `active_competition_id()`-scoped, same tie-breakers) as `v_leaderboard_overall`. This keeps a single source of truth for the ranking algebra and a row shape that maps directly onto `BoardRow`.
- **Week bounds computed on the server, passed as timestamptz.** The page computes the current week's `[from_ts, to_ts)` (week starting Monday 00:00 in the same timezone the rest of the page treats as canonical) and passes explicit UTC instants to `leaderboard_for_window`. Computing bounds in TS (not SQL `now()`) keeps the function pure/testable like `leaderboard_for_day`, which takes its date as an argument rather than reading the clock.
- **`?segment=` is the switch, `?stage=` selects the stage.** `segment ∈ {overall, week, stage}`; when `segment=stage`, `stage` must be one of the active competition's stage keys, otherwise fall back to `overall`. This mirrors `/matches` param parsing (parse → reconcile against the available set → drop unknowns).
- **Segment switcher is server-rendered links.** Like the `/matches` filters, the switcher is `<Link>`s that set the query string, so the page stays SSR and shareable; no client state.
- **Empty segment is a normal, non-error state.** A stage with no scored matches yet (e.g. `final` early in the tournament) or a week with no finals returns zero rows; the page shows the existing empty-state copy rather than an error.

## Risks / Trade-offs

- **DB migration required.** This change adds a migration under `supabase/migrations/` (timestamped) creating `leaderboard_for_window` and `leaderboard_for_stage` with `grant execute ... to anon, authenticated`, matching `leaderboard_for_day`. `v_leaderboard_overall` and `leaderboard_for_day` are left untouched, so existing callers and the overall segment are unaffected — risk is contained to the two new objects. No cron and no Supabase Realtime are needed.
- **Performance.** Both functions scan `scores ⋈ matches ⋈ predictions ⋈ profiles` like the overall view; the `matches_competition_kickoff_idx (competition_id, kickoff_at)` index already supports the week window, and a stage filter is a cheap equality on the same joined `matches`. At current data volumes the cost is comparable to the overall view; if it ever matters, the functions are independently optimizable without touching callers.
- **Week definition ambiguity.** "This week" is a product choice (Monday-start vs Sunday-start, and which timezone). We fix Monday-start in the canonical timezone the page already uses and document it in the spec so the behavior is testable; this is reversible by changing the bounds computation, with no schema impact.
- **Stage validity coupling.** Allowed `stage` values come from the active competition's stage keys (the same set the matches trigger validates). Reconciling `?stage=` against that set (rather than a hardcoded list) keeps the feature competition-agnostic, consistent with the M3/M4 refactor.
- **i18n surface.** Segment labels and stage names need translations in en/es/fr/de; missing a locale would show a key. The verification group includes a check that all four locales have the new strings.
