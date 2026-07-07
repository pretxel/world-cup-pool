# Design: my-picks-latest-first

## Context

The My Picks page (`app/[locale]/(app)/my-picks/page.tsx`) loads the user's full prediction set, orders it in memory with `sortPicksByKickoff` (`lib/picks-order.ts`), then windows it with `paginate`. The sort exists in a pure, unit-tested helper because PostgREST cannot order parent rows by an embedded to-one column. The current comparator is kickoff ascending with a `match_id` tie-break; missing or unparseable kickoffs map to `+Infinity` so they sort last. The `my-picks-pagination` spec pins this ordering as kickoff-ascending.

## Goals / Non-Goals

**Goals:**
- Page 1 of My Picks shows the picks for the newest fixtures (kickoff descending).
- Keep the order total and deterministic: stable tie-break, missing kickoffs still last.
- Keep everything else — page size, clamping, controls, stats, group simulation — byte-identical in behavior.

**Non-Goals:**
- No sort toggle or user preference; the direction just flips.
- No ordering by `submitted_at` (the list is fixture-centric, not submission-centric).
- No hiding of finished matches (that pattern belongs to the Matches list, not here).
- No DB or query changes.

## Decisions

- **Flip the comparator in `lib/picks-order.ts` rather than reversing at the call site.** `sortPicksByKickoff(...).reverse()` would also reverse the tie-break and move missing-kickoff picks to the front — both wrong. The helper owns the ordering contract and its tests; the direction change belongs there.
- **Rename the helper to `sortPicksByKickoffDesc`.** The current name reads as ascending-by-convention. An explicit name makes the one call site and the tests self-documenting. Alternative considered: keep the name and only change behavior — rejected because a silent semantic flip under an unchanged name is exactly what the helper's own header comment warns against.
- **Missing/unparseable kickoffs still sort last.** In a descending comparator that means mapping them to `-Infinity` (not `+Infinity` as today). Users care about real fixtures first; a corrupt row should never occupy page 1.
- **Tie-break stays `match_id` ascending.** The tie-break's only job is reproducibility; there is no reason to flip it and churn the tests more than needed.

## Risks / Trade-offs

- [Users mid-tournament have muscle memory for "page N ≈ matchday N"] → One-time re-learning; page 1 becoming "now" is the point of the change and matches the recent Matches-list default (non-finished first).
- [Reversing only the primary key but not the missing-kickoff rule is easy to get wrong] → The existing unit tests in `tests/picks-order.test.ts` are updated to pin all three properties: descending kickoff, missing-kickoff-last, stable tie-break.
