## Context

The leaderboard is driven by three data sources that all return the same row shape:
`v_leaderboard_overall` (overall page), `leaderboard_for_day()` (per-day), and
`leaderboard_for_group()` (friends' group mini-board). That shape already includes
`winner_hits: number` (count of correct-winner-only predictions, 1 pt each), computed
in SQL alongside `exact_hits` and `winner_gd_hits`.

The shared `components/leaderboard-table.tsx` renders the standings for both the public
`/leaderboard` page and the group board. Its local `BoardRow` type currently omits
`winner_hits`, and the table renders only Rank, Player, Pts, Exact (`exact_hits`), and
W+GD (`winner_gd_hits`). Exact and W+GD are hidden on mobile (`hidden sm:table-cell`);
Pts is always visible.

This change is UI + i18n only: no SQL, scoring, or query changes.

## Goals / Non-Goals

**Goals:**
- Show each player's `winner_hits` as a "Wins" column in the standings table.
- Keep the column responsive and consistent with the existing hit columns.
- Translate the header across all four locales (en, es, fr, de), in both the
  `leaderboard` and `groups` translation namespaces.

**Non-Goals:**
- No changes to scoring, ranking, point totals, or the top-10 cap.
- No database, view, or RPC changes (`winner_hits` is already returned).
- No new columns beyond Wins; the leader card and stats are untouched.

## Decisions

**1. Column placement & order: `Pts | Exact | W+GD | Wins`.**
Append Wins after the existing hit columns so the hit tiers read in descending point
value (Exact 5 → W+GD 3 → Wins 1) and existing column positions don't shift.
_Alternative:_ insert between Pts and Exact — rejected; it reorders established columns
and breaks the high-to-low tier reading.

**2. Responsive behavior: `hidden sm:table-cell`, matching Exact and W+GD.**
On mobile, only Rank / Player / Pts stay visible. Adding a fourth always-visible column
would crowd small screens. Wins follows the same breakpoint as the other secondary stats.

**3. Thread the value via the shared component, not per-page duplication.**
Add `winner_hits: number | null` to `BoardRow` and a `wins: string` field to
`LeaderboardLabels`. Both call sites already `select("*")` / receive full RPC rows, so
`winner_hits` is present at runtime — the only code change is widening the local type and
passing the new label. This keeps the public board and the group board automatically
consistent.
_Alternative:_ a leaderboard-only column with the group board unchanged — rejected;
inconsistent UX for the same component and more conditional code.

**4. Header copy: short, parallel to existing headers.**
Add `headerWins` to the `leaderboard` namespace and `boardWins` to the `groups`
namespace in every locale, e.g. en "Wins", es "Ganados", fr "Gagnés", de "Siege".
Mirror the existing key naming (`headerExact`/`headerWinnerGd`, `boardExact`/`boardWinnerGd`).

## Risks / Trade-offs

- [Runtime row missing `winner_hits` if a caller narrows its select] → All current callers
  use `select("*")` or full RPC returns, and the generated DB types already include
  `winner_hits`; widening `BoardRow` to `number | null` plus a `?? 0` fallback at render
  keeps it safe.
- [Mobile width pressure] → Mitigated by `hidden sm:table-cell`; Wins never renders on the
  narrowest viewport, identical to Exact/W+GD today.
- [Missing translation key in a locale] → Add the key to all four message files in the same
  change; next-intl surfaces missing keys loudly in dev.
