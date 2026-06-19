## Context

`components/recent-recap-images.tsx` (server component) today: queries `match_summary_images` for `status = 'complete'`, `order created_at desc`, `limit(5)`, then fetches those matches for `home_team`/`away_team` (no date), and renders them in render-time order. The active-only RLS yields at most one render per match, so the full set of completed renders is bounded by the number of matches (≤104 for the WC).

To order by match date we need each render's match `kickoff_at`, which the current match query doesn't select, and the "top 5" must be chosen by match date — not derivable from a `created_at`-ordered, pre-limited render query.

## Goals / Non-Goals

**Goals:**
- The 5 images shown are those whose matches are the most recent, ordered by `kickoff_at` descending.
- Preserve sourcing (active completed renders), cap (5), links, alt text, and hidden-when-empty.

**Non-Goals:**
- Changing the cap, the data model, or what counts as a visible render.
- Chronological (ascending) order — most-recent-first per the chosen direction.

## Decisions

### Decision: Select the top 5 by match date, not by render time
Drop the `created_at` ordering + pre-limit. Fetch the completed renders (bounded set, one per match), fetch their matches with `id, home_team, away_team, kickoff_at`, join, sort the joined items by `kickoff_at` descending, then take the first 5. Render in that order.

*Why:* "Top 5 by match date" can't be obtained by limiting a render-time-ordered query first; the join + in-memory sort over the bounded set is correct and simple. Volume is small (≤ one row per match).

*Bounded fetch:* keep a generous safety `limit` on the render query (e.g. 200) so it can't grow unbounded if the data model ever changes; the WC stays well under it.

### Decision: Tie-break
When two matches share a `kickoff_at`, fall back to render `created_at` desc (then match id) for a stable, deterministic order.

## Risks / Trade-offs

- **Fetching all completed renders instead of 5** → bounded by match count (≤104); negligible. The safety limit caps worst case.
- **A very recent match with a freshly generated comic now ranks above older matches** → intended; that's the point of ordering by match date.

## Migration Plan

Single-component change (query fields + sort). No schema/data migration. Rollback = restore the `created_at`-ordered, limit-5 query.

## Open Questions

- None.
