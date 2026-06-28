## Context

`/matches` (`app/[locale]/(public)/matches/page.tsx`) builds its visible list through ordered filters: confirmed-gate → team → round → status → picks. The status step:

```ts
const statusFilter = parseStatusParam(statusParam); // "upcoming" | "live" | "final" | null
const statusFiltered = statusFilter
  ? scoped.filter((m) => statusBucket(m) === statusFilter)
  : scoped;                                          // null → shows EVERYTHING today
```

`statusBucket(m)` returns `"upcoming" | "live" | "final" | "cancelled"`. The header stat cards (`MatchStatusFilter`) and the needs-pick count are computed from `scoped` (the team+round set) **before** the status/picks filters, so each control shows what activating it would yield. The status filter is a single-select owned by `?status=`.

## Goals / Non-Goals

**Goals:**
- Default `/matches` to non-finished fixtures (hide `final` + `cancelled`) so actionable matches lead.
- Preserve the `final` filter as the opt-in to view finished matches.
- Keep stat-card totals accurate (Final card still shows its real count).

**Non-Goals:**
- No change to confirmed-gating, picks filter, scoring, or any non-`/matches` surface.
- No removal of finished matches from the app (still visible via the Final filter, bracket, leaderboard).
- No new persisted preference — the default is stateless (URL-driven, same as today).

## Decisions

### D1: Change only the default branch of the status filter
When `statusFilter` is null, filter out `final` and `cancelled` instead of showing everything:

```ts
const statusFiltered = statusFilter
  ? scoped.filter((m) => statusBucket(m) === statusFilter)
  : scoped.filter((m) => {
      const b = statusBucket(m);
      return b !== "final" && b !== "cancelled"; // default: non-finished only
    });
```

This is the whole behavioral change. Explicit `?status=final|upcoming|live` paths are untouched, so the Final filter still opts finished matches back in.
- *Alternative:* add a fourth "all" filter value / persisted preference. Rejected — the stat cards already provide opt-in; a stateless default keeps the URL model and avoids new state.

### D2: Stat cards keep counting the full scoped set
`stats` (upcoming/live/final) stays computed from `scoped` (pre-status-filter), unchanged. So the **Final** card keeps showing e.g. "68", which both signals finished matches exist and is the affordance to view them. No card is removed.

### D3: `isFiltered` stays false in the default view
The default (no `?status=`) still reads as "not filtered" (`statusFilter === null`), so the first-pick nudge and the standard empty state behave as before. The new hide-finished default is the baseline, not a filter the user must clear.

### D4: Tailored empty state when the default view is empty only because all are finished
If the default view yields zero rows but the scoped set has finished matches (`stats.final > 0` and no active team/round/picks filter), show an "all matches are finished — view results" empty state linking to `?status=final`, instead of the generic `emptyTitle`/`emptyBody`. Keeps the dead-end from looking like "no matches at all".

## Risks / Trade-offs

- **[User expects to see a just-finished match]** a match that goes final disappears from the default view → Mitigation: the Final card stays visible with its count and is the one-tap opt-in; the change is reversible per-request via the URL.
- **[Cancelled has no dedicated filter card]** cancelled matches become hidden with no direct opt-in on `/matches` → Accepted: cancelled fixtures are rare and non-actionable, and a dedicated cancelled view is not requested. (One can be added later if needed.)
- **[Counts vs. list mismatch confusion]** the Final card shows 68 but the list shows none by default → Mitigation: this is the intended affordance (tap to reveal); the tailored empty state (D4) reinforces it when relevant.

## Migration Plan

Single-file behavior change (+ small i18n). Ship `matches/page.tsx`; `/matches` picks it up. Rollback = revert the default branch. No data/config/migration.

## Open Questions

- Should a future "All" affordance exist to show finished + non-finished together in one list? Out of scope; the per-status cards cover current needs.
