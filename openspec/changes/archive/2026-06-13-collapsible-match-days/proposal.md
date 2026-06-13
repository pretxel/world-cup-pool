## Why

The `/matches` list renders every confirmed fixture as a flat, always-expanded
list grouped by day. With 48 teams and a full group + knockout schedule that is
dozens of day sections and well over a hundred rows on one page — long days
(especially finished ones the user no longer cares about) force a lot of
scrolling to reach the fixtures that matter now. Letting users collapse a day's
matches lets them fold away what they're done with and jump faster to today's
and upcoming fixtures.

## What Changes

- Each matchday section on `/matches` becomes collapsible: its sticky day
  header acts as a toggle that shows/hides that day's match rows.
- The header exposes proper disclosure semantics (button, `aria-expanded`,
  controls the row region) and a chevron affordance that rotates with state.
- Collapsing/expanding a day persists across navigation and reloads (localStorage,
  keyed by day) so a user's folded days stay folded.
- Sensible default open/closed state: days whose matches are all finished start
  collapsed; today, live, and upcoming days start expanded.
- The collapse toggle preserves existing behavior — sticky positioning, the
  matchday label, the localized date, and the per-day match count stay in the
  header; the staggered row entrance animation still runs when a day is open.
- New localized strings for the expand/collapse accessible labels (en, es, fr).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `match-presentation`: the matchday grouping on `/matches` gains a
  collapse/expand affordance with persisted, status-derived default state; the
  existing sticky-header requirement is extended to cover the header acting as a
  disclosure control.

## Impact

- `app/[locale]/(public)/matches/page.tsx` — day `<section>` rendering refactored
  so the header + row list are wrapped by a client collapsible shell; server-side
  row rendering (and the stagger animation) is preserved by passing rendered rows
  as `children`.
- New client component `components/match-day-section.tsx` — owns open/closed
  state, persistence, and disclosure semantics.
- `messages/en.json`, `messages/es.json`, `messages/fr.json` — new `matches`
  strings for the collapse/expand labels.
- No database, API, or data-model changes. Anonymous and signed-in flows are
  unchanged apart from the new client-side toggle.
