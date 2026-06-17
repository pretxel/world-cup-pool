## Why

The leaderboard already scores three prediction tiers — exact (5 pts), winner+GD (3 pts), and winner-only (1 pt) — but the standings table only surfaces two of them (Exact, W+GD). The "winner-only" tally (`winner_hits`) is already computed and returned by every leaderboard query yet never shown, so players can't see how many of their predictions landed the correct winner. Exposing it completes the picture of how points were earned.

## What Changes

- Add a **Wins** column to the leaderboard standings table, rendering the existing `winner_hits` value for each row.
- Surface `winner_hits` through the shared `LeaderboardTable` component (type, labels, cell), so the column also appears on the friends' group mini-board that reuses the same component.
- Add the column header translation key (`headerWins` / `boardWins`) across all locales (en, es, fr, de) for both the `leaderboard` and `groups` namespaces.
- No database, query, or scoring changes — the data is already produced.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `leaderboard`: the standings table requirement gains a column exposing the winner-only hit count (`winner_hits`) for each ranked player.

## Impact

- **UI**: `components/leaderboard-table.tsx` — `BoardRow` type, `LeaderboardLabels` type, header row, body cell.
- **Pages**: `app/[locale]/(public)/leaderboard/page.tsx` and `app/[locale]/(app)/groups/[id]/page.tsx` — pass the new `wins` label and ensure `winner_hits` flows into row data.
- **i18n**: `messages/en.json`, `es.json`, `fr.json`, `de.json` — new header key in `leaderboard` and `groups` namespaces.
- **Data**: none. `v_leaderboard_overall`, `leaderboard_for_day()`, and `leaderboard_for_group()` already return `winner_hits`.
