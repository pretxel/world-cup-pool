# Design — Match Status and Needs-Pick Filters

## Context

`/matches` is a server component: it fetches all matches, derives `uiStatusFor` (scheduled/locked/live/final/cancelled), reads `?team=` server-side, and renders a day-grouped list. `MatchTeamFilter` (client) writes the `team` param via `router.replace` preserving locale prefix and unrelated params. `pickedIds` (set of match ids the signed-in user has predicted) is already fetched. Header stats render open/live/final counts from the filtered list; locked-not-live matches currently fall into no stat bucket.

## Goals / Non-Goals

**Goals:**
- Status filter (upcoming/live/final) and needs-pick toggle, both URL-encoded, composing with `?team=`.
- Stats header doubles as the status filter UI; buckets sum to the filtered total.
- Anonymous users never see the needs-pick control.
- Shareable, reload-safe, back/forward-safe URLs — same contract as the team filter.

**Non-Goals:**
- Stage filter (deferred until knockout fixtures are publicly visible).
- Multi-select status, cancelled-status filtering (cancelled matches stay visible in "All" views only).
- Changes to lock logic, pick flow, or data model.

## Decisions

1. **Status filter UI = clickable stat cards, not a second chip row.** The stat cards already display the exact taxonomy with live counts; making them toggles adds zero vertical space (the team-chip scale problem already crowds that area). Cards become `<button aria-pressed>` wrapping the dt/dd content. Alternative — chip row — rejected: duplicates information and stacks more UI above the list.

2. **Single-select status.** Clicking an active card clears it; clicking another switches. Multi-select (live OR final) has no real use case and complicates the URL. Param: `?status=upcoming|live|final`, unknown → ignored.

3. **"Upcoming" bucket = scheduled + locked.** Renames the "open" stat. Fixes buckets not summing to total; the per-row locked badge already communicates pickability. Alternative — fourth "locked" bucket — rejected: locked is a transient pre-live state, not a destination users seek; on most days the bucket reads 0.

4. **Needs-pick semantics: unpicked AND uiStatus === "scheduled" (open for picks).** Not a picked/unpicked pair — the actionable set is "what can I still act on." Param: `?picks=needed`; any other value ignored. Control renders only when `user` exists; the count badge ("To pick · N") computes from the team-filtered set so the badge always matches what toggling would show. Anonymous request with `?picks=needed` in the URL: param ignored server-side (no user, no pick data), list unfiltered.

5. **Filter pipeline order: confirmed → team → status → picks**, all server-side in `page.tsx`. Stats compute after team filter but before status filter — so stat cards show the distribution the user is choosing from (faceted-search behavior: clicking "Live · 3" can't yield an empty list). Needs-pick count likewise computes from the team-filtered set.

6. **Param helpers live in `lib/match-utils.ts`** beside `parseTeamParam`/`reconcileSelectedTeams` — same drop-unknown defense, unit-testable pure functions.

7. **One client component owns all filter writes.** Extend `MatchTeamFilter` into a filter bar (or add a sibling sharing a small `useFilterParam` helper) so URL-rewriting logic isn't duplicated. Either way the write pattern stays `router.replace` with `scroll: false`, preserving locale prefix and unrelated params.

## Risks / Trade-offs

- [Stats-as-buttons changes header semantics for screen readers] → keep `<dl>` structure, put `aria-pressed` buttons inside `<dd>`, label each with stat name + count; verify with axe or manual VoiceOver pass.
- [Faceted counts (stats before status filter) can confuse: selecting "Final" then adding a team may show stale-feeling counts] → counts always recompute server-side per request; the chosen order is deterministic and documented in code comments.
- [`?picks=needed` shared by a signed-in user, opened anonymously → different result set] → acceptable: param silently ignored, page still renders; spec scenario covers it.
- [Locked matches absorbed into "upcoming" may surprise users expecting to pick them] → row badge still says locked; match detail page already refuses late picks (predictions-lock capability).

## Migration Plan

Single PR, no data changes. Rollback = revert. Rename of the "open" stat label is copy-only (`statOpen` key can be reworded or replaced per locale).

## Open Questions

None blocking. Minor: whether to fold the needs-pick toggle into the stats row visually or place it beside the team filter label — defer to implementation aesthetics.
