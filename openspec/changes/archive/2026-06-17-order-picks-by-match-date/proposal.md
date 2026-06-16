## Why

The My Picks list is meant to read top-to-bottom in match order (earliest kickoff
first) — the `my-picks-pagination` spec already requires it. But it doesn't: the query
uses `.order("kickoff_at", { foreignTable: "matches", ascending: true })`, which
PostgREST applies to the **embedded** `matches` rows, not the top-level `predictions`
rows. Because each prediction embeds exactly one match (a to-one relation), that ordering
is a no-op — the predictions come back in PostgREST's default (insertion/primary-key)
order. So picks render in an arbitrary order across the page and across pagination pages,
not by match date as intended.

## What Changes

- Order the user's picks by their match's `kickoff_at` ascending **deterministically**,
  independent of PostgREST embedded-resource ordering semantics. The page already loads
  the full pick set into memory before paginating, so sort there.
- Break ties (multiple fixtures sharing a kickoff time) with a stable secondary key so
  the order is reproducible run-to-run and page-to-page.
- Remove reliance on the ineffective embedded `.order(...)` clause (it sorts a single
  embedded row and does nothing useful here).
- No change to pagination size, controls, header stats, the group simulation, or the row
  markup — only the order the rows actually come out in.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `my-picks-pagination`: tighten the existing "retain their existing order (by match
  kickoff time, ascending)" requirement so the ordering is a guaranteed, deterministic
  property of the rendered list (kickoff ascending with a stable tiebreaker), applied
  before pagination — rather than relying on a query clause that does not actually sort
  the predictions.

## Impact

- **Page:** `app/[locale]/(app)/my-picks/page.tsx` — replace the embedded `.order(...)`
  with an in-memory sort of the loaded picks by `matches.kickoff_at` (asc) + tiebreaker
  before the `paginate(...)` / `slice(...)` step.
- **Behavior:** picks now render earliest-match-first and pages partition that single
  global order; no schema, migration, or API change.
- **Tests:** add coverage for a reusable ordering helper (kickoff ascending, stable
  tiebreak, null/edge handling) so the bug cannot silently regress.
