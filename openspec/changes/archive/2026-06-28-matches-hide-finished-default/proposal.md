## Why

The public `/matches` list shows every visible fixture by default, including the 68 already-final matches. Most of the time a player opens `/matches` to act on what's still actionable — upcoming and live fixtures they can predict — and has to scroll past dozens of finished games to find them. Defaulting the list to non-finished matches puts the actionable fixtures first, while keeping the existing "Final" filter so completed results stay one tap away.

## What Changes

- Change the **default** `/matches` view to exclude **finished** fixtures (`final` and `cancelled`), showing only upcoming/live (scheduled, locked, and live) fixtures.
- Keep the existing single-select status filter: tapping **Final** still lists the finished matches (opt-in preserved); `?status=upcoming` / `?status=live` behave as today.
- Keep the header stat cards (`Upcoming · Live · Final`) showing **true totals** over the team/round-scoped set — so the Final card still shows its count and signals that finished matches exist behind it.
- Add a tailored **empty state** for the case where the default view is empty only because every in-scope match is finished — pointing the user to the Final filter instead of a generic "no matches" message.
- This is a default-behavior change to the public list only. No change to confirmed-gating, picks, scoring, the data model, or any other surface.

## Capabilities

### New Capabilities
<!-- None. This refines the default visible set of the existing /matches list governed by match-availability. -->

### Modified Capabilities
- `match-availability`: Add a requirement that the `/matches` list, with no status filter selected, excludes finished (`final`/`cancelled`) fixtures by default, while the `final` status filter still opts them back in and the header stats continue to count the full scoped set.

## Impact

- **Primary code:** `app/[locale]/(public)/matches/page.tsx` — the default branch of the status filter (`statusFiltered`) excludes `final`/`cancelled` when no `?status=` is set; small empty-state addition.
- **i18n:** may add an "all in-scope matches are finished" empty-state title/body + a CTA label to `messages/{en,es,fr,de}.json` (keep locale parity).
- **Reused/unchanged:** `statusBucket`, `parseStatusParam`, `MatchStatusFilter` cards (counts still computed pre-status-filter), the team/round/picks filters, matchday grouping, first-pick nudge.
- **Surfaces:** `/matches` only. Public, no auth/DB change. No breaking change; the Final filter preserves access to finished matches.
