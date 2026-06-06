## Context

`/matches` is a server component (`app/[locale]/(public)/matches/page.tsx`) that fetches the full `matches` table ordered by kickoff, day-groups it, computes header stats, and renders each row via `MatchRowCard`. Teams are plain text columns (`home_team`, `away_team`) — there is no team entity, no per-user "follow" relation, and `profiles` has no favorite-team column. The page already reads route `params` as a `Promise` and the codebase reads `searchParams` as a `Promise` (see `sign-in/page.tsx`). Locale-aware client navigation is done with `useRouter`/`usePathname` + `useTransition` (see `language-switcher.tsx`).

This change adds an ephemeral team filter. The user's "follow" intent is satisfied by letting them pick the team(s) they care about; no persistence or auth is in scope (decided with the user during proposal).

## Goals / Non-Goals

**Goals:**
- Let a visitor narrow the `/matches` list to fixtures involving one or more chosen teams.
- Make the filtered view shareable and reload/back-forward safe via a `?team=` URL param.
- Keep header stats, day-group counts, and the empty state consistent with the filtered set.
- Localize every new string; respect existing visual conventions.

**Non-Goals:**
- No `followed_teams` table, profile column, RLS, or auth-gated follow/unfollow UI.
- No server round-trip purely to filter (the full list is already fetched).
- No changes to match detail, my-picks, or leaderboard.
- No fuzzy search/typeahead — a finite chip set over the schedule's teams is enough.

## Decisions

### D1: Source of truth for the active filter is the URL `?team=` param, read server-side
The server component reads `searchParams` (a `Promise`), parses `team` into a normalized set of team names, and applies the filter **before** day-grouping and stat computation. Rendering off the URL (not client state) keeps the server output, stats, day counts, and rows in agreement, and makes the view shareable and SSR-correct on first paint.

- **Format**: `?team=Brazil,Argentina` (comma-separated, single param). Accept repeated `?team=` too if Next hands back an array — normalize either shape. Comma-separated is chosen for compact, human-readable shareable links.
- **Matching**: a match is included when `home_team` or `away_team` is in the selected set, compared case-insensitively against the exact seeded team strings. Unknown/placeholder values in the param are ignored.
- **Alternative considered**: pure client-side `useState` filter with no URL. Rejected — not shareable, lost on reload, and forces stats/day-counts to be recomputed in the client, duplicating logic.

### D2: The chip row is a thin client component; the page stays a server component
A new `"use client"` component (e.g. `components/match-team-filter.tsx`) renders the selectable chips + "All" reset and is the only interactive piece. On toggle it updates the URL via `useRouter().replace(...)` inside `useTransition`, mirroring `language-switcher`'s pattern, preserving the locale prefix and other params. The server component receives the new `searchParams` and re-renders the filtered list.

- The available team list is derived **on the server** from the fetched matches (distinct real country teams, placeholders excluded) and passed to the client component as a prop, plus the currently-selected set — so the client never needs to re-fetch or know the full schedule.
- **Alternative considered**: making the whole page client-side. Rejected — loses server data fetch, Supabase server client, and SSR.

### D3: Identifying "real" teams vs knockout placeholders
Only country teams are offered as chips. Reuse the existing flag mapping (`lib/team-flag.ts` / `flagSlug`) used by `TeamFlag`: a team is a real country iff it resolves to a flag slug. Placeholders like "2nd Group A" resolve to null and are excluded from chips (they can still appear in rows of unfiltered view). This avoids a second, drifting source of truth for "what is a team."

- **Alternative considered**: a hardcoded participating-teams constant. Rejected — duplicates the flag map, which a test already keeps in sync with the seed.

### D4: Filter helpers live in `lib/match-utils.ts`
Add small pure helpers — parse the `team` param into a normalized `Set<string>`, derive the distinct filterable teams from a match list, and an `includesTeam(match, set)` predicate. Keeps `page.tsx` thin and makes the logic unit-testable (the repo already has `tests/match-utils.test.ts`).

### D5: Stats, day counts, and empty state derive from the filtered list
Compute the filtered list first, then build day groups and stats from it. When a filter is active but matches nothing, render a distinct empty state ("no matches for the selected team(s)") with a clear-filter affordance, separate from the existing "no matches at all" copy.

## Risks / Trade-offs

- **Stale chips if the schedule has very few distinct teams early** → The chip list is derived from whatever matches exist; if seeding is partial the chip set is simply smaller. Acceptable; matches reality.
- **Param tampering / unknown team values in URL** → Parsing ignores any value that isn't a known seeded team, so a bad `?team=` yields an empty selection (treated as "All") or a valid subset; never an error.
- **Locale prefix / other params dropped on URL update** → Mitigated by building the next URL from `usePathname()` + existing `useSearchParams()` and only mutating the `team` key, matching the established switcher pattern.
- **Long chip row on mobile** → Horizontal scroll / wrap on the chip container; no layout shift. Visual-only, low risk.

## Migration Plan

Pure additive frontend change. No DB migration, no data backfill. Deploy is the standard build; rollback is reverting the commit. The `?team=` param degrades gracefully — older bookmarks without it show the full list.

## Open Questions

- Multi-select vs single-select chips: design assumes **multi-select** (follow several teams). If product wants single-select, the predicate and URL stay the same (set of size 1); no structural change.
