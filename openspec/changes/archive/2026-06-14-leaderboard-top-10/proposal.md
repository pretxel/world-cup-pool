## Why

The public `/leaderboard` renders every ranked player in one ungated list. As the pool grows this becomes a long, low-signal scroll where the meaningful competition — the leaders — is buried. Limiting the visible board to the top 10 keeps the page focused on what visitors care about, while still letting a signed-in player see their own standing.

## What Changes

- The `/leaderboard` page shows only the **top 10** ranked players in the standings table (ranks 1–10).
- The total player count, the leader card, and the "your rank" share section keep reflecting the **full** field, not just the top 10 — so the headline stat ("leading N players") and a signed-in user's own standing stay correct even when that user is outside the top 10.
- No SQL/view changes: `v_leaderboard_overall` still returns the full ranking; the cap is applied when selecting the rows passed to the standings table.
- Group mini-boards and the per-user share/rank pages are **out of scope** — only the main public leaderboard is capped.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `leaderboard`: adds a requirement that the public `/leaderboard` standings table renders at most the top 10 ranked players, while total-count and current-user standing continue to reflect the full field.

## Impact

- Code: `app/[locale]/(public)/leaderboard/page.tsx` (slice rows passed to the table; preserve `players` count, `leader`, and `myRow` from the full result).
- Components: `components/leaderboard-table.tsx` — no change required (it renders whatever rows it is handed).
- Data: no migration; `v_leaderboard_overall` unchanged.
- No API, dependency, or breaking changes.
