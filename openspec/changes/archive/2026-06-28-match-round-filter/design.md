## Context

`/matches` (`app/[locale]/(public)/matches/page.tsx`) already composes ephemeral, URL-encoded filters. The pipeline is: load matches → gate to the visible set (`isConfirmedMatch(m) || revealed.has(m.stage)`) → **team** filter (`reconcileSelectedTeams`/`matchInvolvesTeam`, multi-select `?team=`) → compute header status **stats** from the team-filtered set → **status** filter (`parseStatusParam`, single-select `?status=`) → **picks** filter → day-group by the visitor's local day. Filter helpers live in `lib/match-utils.ts`; each control is a small client component that only writes its URL param via `useQueryParamWriter` (`match-team-filter.tsx`, `match-status-filter.tsx`). Stage labels come from the active competition format via `getStageLabel(format, stageKey, locale)`; `sortedStages(format)` gives canonical order.

## Goals / Non-Goals

**Goals:**
- A round filter on `/matches`, consistent with the existing team/status controls (chips, URL-encoded, server-read).
- Localized round labels from the competition format; only rounds with fixtures shown, in stage order.
- Compose cleanly with team/status/picks filters and the day grouping; empty days hidden.

**Non-Goals:**
- No multi-round selection (single-select, like status).
- No change to pickability, visibility gating, or the bracket.
- No new stored state — purely a URL filter.

## Decisions

### Decision: Single-select, URL param `?round=<stageKey>`
Mirror the status filter: one round at a time; re-selecting the active round (or choosing "All") clears it. `?round=` holds the stage `key`. A param that doesn't match a round present in the schedule is ignored (treated as "All"), so stale/forged values never error.

*Alternative considered:* multi-select (like team). Rejected — rounds are mutually-exclusive phases; a player wants "the Round of 16", not a union. Single-select keeps the URL and UI simpler.

### Decision: Build round options server-side from the format
The page computes `roundOptions = sortedStages(format).filter(s => present.has(s.key)).map(s => ({ key: s.key, label: getStageLabel(format, s.key, locale) }))`, where `present` is the set of `stage` values in the **visible** list. This keeps ordering and localized labels on the server (where the format lives) and passes plain `{key,label}[]` to the client control — the same pattern as the team filter passing resolved team strings.

*Alternative considered:* derive labels client-side from a generic `stageLabel`. Rejected — loses the competition's localized stage names and canonical order.

### Decision: Apply the round filter into the scoped set used for stats
Insert the round filter alongside the team filter, before the status stats are computed: `scoped = teamFiltered.filter(m => !round || m.stage === round)`; compute the status stats and the needs-pick count from `scoped`; then apply status/picks. This makes the header counts reflect the chosen round (consistent with how the team filter already feeds the stats), and day grouping operates on the filtered result so empty days disappear.

### Decision: Helpers in `match-utils.ts`, control mirrors `match-team-filter.tsx`
Add `parseRoundParam(raw): string | null` (first value, trimmed, or null) and a small `stagesPresent(matches): Set<string>` for the present-rounds derivation. The new `MatchRoundFilter` client component renders an "All rounds" chip plus one chip per option and writes `?round=` via `useQueryParamWriter`, visually consistent with the team chips.

## Risks / Trade-offs

- **Round filter + team/status filters yielding empty results** → the existing empty-state handles "no matches"; `isFiltered` includes the round so the "clear filters" affordance and copy are correct.
- **Group stage shown as a round** → intended: "rounds" includes the group stage when present; the option list simply reflects the stages that exist.
- **Stale `?round=` after the schedule changes** → validated against `present`; an unmatched value falls back to "All".
- **Placeholder (revealed-but-unconfirmed) rows under a knockout round** → unaffected; they carry a real `stage` and filter normally, still rendered read-only by the row.

## Migration Plan

Additive UI filter. Deploy; no data/schema change, no migration. Rollback = revert the diff; any `?round=` URL simply stops filtering.

## Open Questions

- Place the round control above or below the team filter? (Default: above the team filter, directly under the header stats, so phase → team → status reads top-down.)
- Show a fixture count per round chip (like the status stats)? (Default: no count for v1; keep chips compact.)
