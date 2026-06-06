## Why

The `/matches` page lists every tournament fixture in one long, chronological feed. A visitor who only cares about a particular country (the team they "follow") has to scroll the whole schedule to find that team's games. A lightweight team filter lets them narrow the list to the matches they care about, with no sign-in or persistence required.

## What Changes

- Add a team filter control to the top of the `/matches` page: a horizontal row of selectable team chips plus an "All" reset, covering the distinct teams present in the schedule.
- When one or more teams are selected, the day-grouped match list shows only matches where the selected team is `home_team` or `away_team`. Empty day groups are hidden.
- Reflect the active selection in the URL as a `?team=` query parameter (repeatable / comma-separated) so a filtered view is shareable and survives reload and back/forward navigation.
- Update the header stats (open / live / final counts) and the day-group counts to reflect the filtered set, and show a filter-aware empty state when the selection matches no fixtures.
- Localize all new UI strings (filter label, "All", empty state) through the existing `matches` i18n namespace.
- Knockout placeholder participants (e.g. "2nd Group A") are excluded from the chip list; only real country teams are offered as filters.

No database schema, auth, or per-user persistence is introduced. This is an ephemeral, client-driven filter over the already-fetched match list.

## Capabilities

### New Capabilities
- `match-team-filter`: Client-side filtering of the public `/matches` list by one or more participating teams, with the active selection encoded in the URL for shareable, reload-safe filtered views.

### Modified Capabilities
<!-- match-presentation covers visual rendering only (flags, stage icons, animations); list filtering is new behavior and does not change any existing match-presentation requirement. No existing spec requirements change. -->

## Impact

- **Code**: `app/[locale]/(public)/matches/page.tsx` (server component — read `?team=` from `searchParams`, derive the team list, apply the filter before day-grouping and stat computation). New client component for the interactive chip row that updates the URL. Possibly a small helper in `lib/match-utils.ts` for normalizing/parsing the `team` param.
- **i18n**: New keys in the `matches` namespace across all locale message files.
- **APIs / DB**: None. No migration, no new query — filtering happens over the existing `matches` select.
- **Dependencies**: None new; uses existing Next.js App Router `searchParams` and `next-intl`.
