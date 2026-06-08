## Context

`app/[locale]/(app)/my-picks/page.tsx` is an async Server Component. It already:
- fetches the user's predictions joined to matches, ordered by `matches.kickoff_at` asc;
- fetches the user's `scores` and derives header stats (total picks, exact count, total points) from the full set;
- (since the group-simulation change) fetches all group fixtures and renders an all-groups simulated standings section.

The matches list page (`matches/page.tsx`) establishes the app's pattern for ephemeral URL state: a `searchParams: Promise<...>` prop read server-side (the `?team=` filter). My Picks currently takes no `searchParams`. The per-user pick set is small (bounded by the ~104 tournament fixtures) and already fully loaded in memory for stats and simulation.

## Goals / Non-Goals

**Goals:**
- Show at most 5 picks per page, paged via `?page=`, server-rendered and shareable.
- Robust clamping so any `page` value yields a valid render.
- Keep stats and group simulation computed over the whole pick set.
- A pure, testable helper for the page math (clamp + slice bounds).

**Non-Goals:**
- Paginating the group-standings section.
- Client-side/infinite-scroll pagination or a data-fetching round-trip per page.
- A configurable page size or a jump-to-page input (prev/next + indicator only).
- Server-side `range()` queries / count headers (unnecessary at this data size).

## Decisions

### D1 — Server-side pagination via `?page=`, in-memory slice
Add `searchParams: Promise<{ page?: string }>` to the page, parse it, and slice the already-fetched, already-ordered picks array. **Why:** matches the existing `?team=` server pattern; no new query, no client JS, back/forward and deep links work for free. The full array is already in memory for stats + simulation, so slicing is free. **Alternative considered:** Supabase `.range()` with an exact count — rejected: adds a second round-trip and a count query for a list that's already fully loaded, and would split the source of truth for "how many picks."

### D2 — Pure page-math helper (testable)
Add a small pure function (e.g. `lib/pagination.ts` `paginate(totalItems, requestedPage, pageSize)`) returning `{ page, totalPages, start, end }` with clamping (page → 1..totalPages, totalPages ≥ 1). The page slices `picks.slice(start, end)`. **Why:** keeps the clamp/boundary logic unit-testable away from the RSC, mirroring how `lib/scoring.ts` / `lib/group-standings.ts` isolate logic. Reusable if another list needs paging later. **Constant:** `PAGE_SIZE = 5` co-located with the helper or the page.

### D3 — Clamp, don't 404
Out-of-range/invalid `page` resolves to the nearest valid page rather than `notFound()`. **Why:** a stale link (e.g. `?page=8` after picks were edited) should still show useful content. The visible page reflects the clamped value (controls render "Page 3 of 3", not "8 of 3").

### D4 — Controls
A presentational control below the list: previous/next as `<Link href="?page=N">` (or disabled `<span>` at bounds) plus a "Page X of Y" label. Hidden when `totalPages <= 1`. Links carry only `?page=`; My Picks has no other query state to preserve. **Why:** minimal, matches the app's link-based navigation; disabling at bounds avoids dead links.

### D5 — Stats & simulation untouched
Stats and `simulateAllGroups` keep reading the full `picks` array; only the rendered list uses the slice. **Why:** the page count and "Exact/Points" totals describe the whole campaign, not the current window; the simulation aggregates every prediction by definition.

## Risks / Trade-offs

- **Edited picks shift pages** (deleting a pick can drop the last page) → clamping (D3) keeps any landed `?page=` valid; worst case the user sees the new last page.
- **Whole list still fetched even though only 5 show** → acceptable and intentional: the set is small and needed in full for stats + simulation; ranged fetching would cost more (extra query) than it saves.
- **Two sources of "page" truth (URL vs clamped)** → resolved by always rendering from the clamped value and pointing controls at clamped neighbors, so the URL is advisory.

## Migration Plan

Additive, read-only, no migration. Ship the helper + tests, then wire the page and controls. Rollback = render the full list again (drop the slice); nothing persisted.

## Open Questions

- Show a compact numbered pager (1 2 3 …) instead of prev/next? Prev/next + "X of Y" chosen for simplicity; can extend later without a spec change.
