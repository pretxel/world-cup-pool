# Proposal: match-section-responsive

## Why

The public `/matches` section was built and reviewed primarily at desktop widths. Match rows pack a fixed-width kickoff column, a vertical divider, two flag+name pairs on a single line, and a right-aligned status column into one horizontal flex row — on narrow phones (320–400px) team names truncate aggressively, the status column squeezes, and long venue or label strings risk horizontal overflow. With the tournament starting June 11, the matches list is the most-visited page on mobile and needs to be validated and fixed for all device sizes.

## What Changes

- Audit the `/matches` page at standard breakpoints (320, 375, 414, 768, 1024, 1280+) covering: page header, status stat-card filter, needs-pick toggle, team chip filter, sticky day headers, match row cards, and the empty state.
- Restructure `MatchRowCard` so it degrades gracefully on small screens (e.g. stack or compress the kickoff column, allow team names to wrap or truncate without crowding out the score/status column, keep tap targets ≥ 44px).
- Ensure no horizontal page overflow at any width ≥ 320px (no `overflow-x` scroll caused by the matches section).
- Verify sticky day headers keep the correct offset under the site nav on mobile and desktop.
- Verify filter controls (status cards, team chips, needs-pick toggle) remain usable and legible at 320px — chips wrap, stat cards don't clip their labels.
- No data, routing, or filtering behavior changes — purely presentational.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `match-presentation`: add a requirement that the public matches list renders responsively — no horizontal overflow, legible team rows, and usable controls from 320px-wide viewports up to desktop.

## Impact

- `app/[locale]/(public)/matches/page.tsx` — `MatchRowCard` layout, day-header markup, responsive sticky offsets.
- `components/match-status-filter.tsx` — stat-card sizing/typography at narrow widths (verify, adjust if clipping).
- `components/match-team-filter.tsx` — chip wrapping (verify, expected already correct via `flex-wrap`).
- `components/needs-pick-toggle.tsx` — verify only.
- `components/site-nav.tsx` — audit found the signed-out "sign in" button visible at all widths (display-class conflict), overflowing the nav at 320px in es/fr; fixed via proper `cn()` merge. Added during apply.
- No API, database, or dependency changes. No behavior changes to filters or links.
