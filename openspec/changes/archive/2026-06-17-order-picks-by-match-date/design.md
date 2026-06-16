## Context

`app/[locale]/(app)/my-picks/page.tsx` loads the user's predictions with:

```ts
.from("predictions")
.select("match_id, home_goals, away_goals, submitted_at, matches!inner(*)")
.eq("user_id", user.id)
.order("kickoff_at", { foreignTable: "matches", ascending: true });
```

postgrest-js turns `.order(col, { foreignTable: "matches" })` into the embedded-resource
order form (`matches.order=kickoff_at.asc`) — it orders the rows of the **embedded**
`matches` relation, not the top-level `predictions`. Because the embed is to-one (each
prediction has exactly one match), there is only ever one embedded row, so the clause
sorts nothing. PostgREST then returns the predictions in its default order (effectively
primary-key / insertion order), which is why the list renders out of match-date order.

The page already materializes the whole set in memory before paginating:

```ts
const allPicks = picks ?? [];
const pageInfo = paginate(allPicks.length, parsePageParam(pageParam));
const pagePicks = allPicks.slice(pageInfo.start, pageInfo.end);
```

So the fix has a natural home: sort `allPicks` deterministically before `paginate`/`slice`.

## Goals / Non-Goals

**Goals:**
- Picks render earliest-kickoff-first, and pagination pages partition that single global
  order (page 1 = earliest five, etc.) — matching the `my-picks-pagination` spec.
- Ordering is deterministic and reproducible, including for fixtures sharing a kickoff
  time (stable tiebreaker).
- Ordering does not depend on PostgREST/database return order or on embedded-resource
  order semantics.

**Non-Goals:**
- No change to page size, the `page` param/clamping, controls, header stats, or the group
  simulation.
- No day-grouping or visual redesign of the list.
- No schema, migration, RLS, or API change.

## Decisions

### Decision: Sort in memory before pagination, not via the query

Replace the ineffective embedded `.order(...)` with an explicit in-memory sort of the
loaded picks by `matches.kickoff_at` ascending, applied right before `paginate(...)`.

- **Why:** the page already holds the full set in memory for stats + the group simulation;
  sorting there is O(n log n) on a handful of rows, fully deterministic, and immune to
  PostgREST embed-order quirks.
- **Alternative — fix the query to order the parent by the embedded column:** PostgREST
  top-level ordering by a to-one embedded column is awkward to express through
  postgrest-js's `.order` (the same option that is currently misfiring) and would keep the
  ordering coupled to a server-side behavior that already surprised us. Rejected.
- **Alternative — denormalize `kickoff_at` onto `predictions`:** schema change for no real
  benefit; the data is already joined in. Rejected.

### Decision: Extract a small, tested ordering helper

Add a pure helper (e.g. `sortPicksByKickoff(picks)` in `lib/`) that sorts by
`matches.kickoff_at` ascending with a stable secondary key, rather than inlining a
comparator in the page. Keeps the page lean and lets the ordering be unit-tested so the
bug cannot silently regress.

### Decision: Stable tiebreaker = match_id ascending

When two picks share a kickoff time, order them by `match_id` (string compare). `match_id`
is always present and unique per pick, so the result is total and reproducible. Invalid /
missing `kickoff_at` values sort last (defensive), keeping the comparator total even on
unexpected data.

## Risks / Trade-offs

- **[Embedded `matches` typed loosely in the page (`as any`)]** → The helper reads
  `pick.matches.kickoff_at`; type the helper's input narrowly (the fields it needs) so the
  sort is type-checked even though the page currently casts. Mitigation: helper owns a
  minimal input type.
- **[Sorting in JS vs DB on large sets]** → Non-issue: a single user's predictions are at
  most the tournament's match count (tens), already fully loaded for stats/simulation.
- **[Regression risk]** → Covered by unit tests on the helper (ordering, ties, edge/null)
  and the existing pagination tests, which keep windowing behavior intact.

## Migration Plan

Pure code change to one page + one new helper (+ tests). No data migration. Ships with the
deploy; rollback is a revert with no cleanup.

## Open Questions

- None. Secondary sort key (`match_id`) and null handling are implementation details that
  do not affect the contract (deterministic kickoff-ascending order).
