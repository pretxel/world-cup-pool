# Proposal: my-picks-latest-first

## Why

The My Picks list orders predictions by kickoff time ascending, so page 1 always shows the user's oldest picks (the tournament's opening fixtures). Mid-tournament, the picks a user actually cares about — today's matches, the most recent results, upcoming fixtures they just predicted — are buried on the last pages. Users should see their latest picks first.

## What Changes

- Reverse the My Picks list ordering from kickoff ascending (earliest first) to kickoff descending (latest first), so page 1 shows the picks for the newest fixtures.
- The ordering remains a total, deterministic order over the full pick set (stable tie-break on equal kickoffs), established before pagination — pages partition one global kickoff-descending order.
- Pagination behavior (page size 5, `page` param clamping, controls), header stats, and the group simulation are unchanged.
- Update the existing unit tests for the ordering helper to assert the new direction.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `my-picks-pagination`: The "Predictions list paginated at five per page" requirement changes from kickoff-ascending to kickoff-descending ordering. Page 1 holds the five latest-kickoff picks; missing/unparseable kickoffs sort last.

## Impact

- `lib/picks-order.ts` — `sortPicksByKickoff` comparator direction (or a renamed equivalent).
- `app/[locale]/(app)/my-picks/page.tsx` — call site and its ordering comment.
- `tests/picks-order.test.ts` — assertions flip to descending.
- No database, API, or i18n changes; the sort is in-memory and server-rendered.
