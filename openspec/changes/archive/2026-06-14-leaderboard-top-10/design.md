## Context

The public `/leaderboard` page (`app/[locale]/(public)/leaderboard/page.tsx`) fetches the full ranking from the `v_leaderboard_overall` view (already ordered by `rank`) and passes every row to `LeaderboardTable`. The same `rows` array also drives three other derived values on the page:

- `leader = rows[0]` — the leader card in the header.
- `players = rows.length` — the total field size, shown in the leader stat ("leading N players") and the share text.
- `myRow = rows.find(r => r.user_id === user.id)` — the signed-in user's own standing, which gates the "share your rank" section.

The view filters out admins and computes a contiguous `rank()` in SQL. There is no limit anywhere today.

## Goals / Non-Goals

**Goals:**
- Render only the top 10 ranked players in the standings table.
- Keep the leader card, the total player count, and a signed-in user's own standing accurate against the **full** field, even when that user ranks 11th or lower.
- Zero behavior change to SQL, views, or the shared `LeaderboardTable` component.

**Non-Goals:**
- Pagination, "load more", or a "show all" toggle.
- Capping group mini-boards (`leaderboard_for_group`) or the per-user `/share/rank` page.
- Inserting the current user's own row inline below the top 10 (a common leaderboard pattern). The existing share section already surfaces their rank; an inline "your position" row is a possible future enhancement, not part of this change.

## Decisions

**Decision: Slice in the page, keep the full fetch — do not add `.limit(10)` to the query.**

The query stays `select("*").order("rank")` returning all rows. The page derives:
- `topRows = rows.slice(0, 10)` → passed to `LeaderboardTable`.
- `players`, `leader`, `myRow` → still computed from the full `rows`.

Rationale / alternatives considered:
- *Add `.limit(10)` to the Supabase query.* Rejected: it would silently break `players` (caps at 10) and `myRow` (a rank-11+ user vanishes, killing their share section). Restoring correctness would then require a separate `count` query **and** a separate current-user-row query — three round trips for a list that, at this product's scale, fits comfortably in one fetch.
- *Cap in SQL / a new view.* Rejected: heavier, needs a migration, and still loses the total count and the outside-top-10 user's row.

The slice-in-page approach is the smallest correct change and preserves every existing derived value with no extra queries.

**Decision: top 10 means ranks 1–10 by `slice(0, 10)`, not "rank <= 10".**

Rows arrive ordered by `rank`. `slice(0, 10)` takes the first 10 rows regardless of tie semantics. Ties are already broken deterministically in SQL (`exact_hits`, `winner_gd_hits`, `first_submit`), so the first 10 rows are unambiguous. If fewer than 10 players exist, the table simply shows them all.

## Risks / Trade-offs

- **[A rank-11+ user no longer sees themselves in the visible table]** → Their standing is still shown via the existing "share your rank" section (driven by `myRow` from the full fetch), so they keep a clear view of their position. Documented as accepted; inline "your position" row noted as future work.
- **[Full result is still fetched from the DB even though only 10 render]** → Acceptable at current scale (a single pool). No measurable cost; revisit with server-side limiting + a count query only if the field grows large.
- **[Empty / small fields]** → `slice(0, 10)` is safe for 0–10 rows; the existing empty-state branch (`rows.length === 0`) is unaffected because it checks the full array before slicing.
