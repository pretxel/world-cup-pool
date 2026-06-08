## Why

The My Picks list renders every prediction a user has made in one unbroken column. Once a user has picked many matches (the tournament has 100+ fixtures), the page becomes a long scroll with no way to step through it. Paging the list keeps the page short and scannable.

## What Changes

- Paginate the predictions list on **My Picks** to **5 picks per page**.
- Drive the current page from a `?page=` URL query param (server-rendered, shareable, back-button friendly), defaulting to page 1.
- Clamp out-of-range or invalid `page` values to the valid range (1…last page) so a bad URL never 500s or shows a blank list.
- Render pagination controls (previous / next + a "Page X of Y" indicator) below the list, disabled at the first/last page, hidden entirely when there is ≤ 1 page.
- Keep the header stats (total picks, exact count, total points) computed over **all** picks, not just the visible page.
- Leave the simulated group-standings section (all 12 groups) **unpaginated** — it summarizes every pick regardless of the visible page.

## Capabilities

### New Capabilities
- `my-picks-pagination`: How the My Picks predictions list is split into fixed-size pages — page size, the `page` query param and its clamping, what stays whole-set (stats, group simulation), and the pagination controls.

### Modified Capabilities
<!-- None. The picks list has no existing spec; stats and group simulation behavior are unchanged. -->

## Impact

- **Code**: `app/[locale]/(app)/my-picks/page.tsx` gains a `searchParams` prop, page math, and a list slice; a small pagination control (new component or inline).
- **Data**: read-only; existing predictions fetch is reused. Slicing happens in memory (the per-user pick set is small and already loaded for stats + simulation) — no new query, no schema change.
- **i18n**: new `myPicks` pagination keys (prev / next / "Page {current} of {total}") across `en` / `es` / `fr`.
- **Tests**: unit coverage for the page-clamp + slice helper (in/out-of-range pages, last partial page, single page).
