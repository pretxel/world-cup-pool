## Why

The landing page already flips the "Tournament live" section to a live pill once the
tournament opens, but it never shows _which_ matches are actually being played right
now. Visitors arriving mid-tournament see a generic "Picks open across the bracket"
message instead of the real fixtures in play — a missed chance to pull them into the
action and onto a match page. We want the live section to answer "who is playing live?"
at a glance, with scores that stay current.

## What Changes

- Add a **live fixtures list** to the landing page's "Tournament live" section. When one
  or more matches have `status = "live"` (or have kicked off and are not yet final), show
  each fixture: both teams with flags, the live score, and a "Live" badge, each linking to
  its match page.
- **Auto-refresh** the live list roughly every 30s via a lightweight server action / route
  so scores and statuses update without a full page reload. Polling pauses when the tab is
  hidden and stops once nothing is live.
- **Next-up fallback**: when the tournament is live but no match is currently in play
  (between kickoffs), the section shows the soonest upcoming fixture with a kickoff
  countdown instead of an empty space.
- Keep the existing pre-tournament countdown behavior unchanged; the new list only appears
  in the live branch.
- Add i18n message keys (`en`, `es`, `fr`) for the live-list heading, the "no match on
  right now" / next-up copy, and per-fixture labels.

## Capabilities

### New Capabilities
- `landing-live-matches`: Renders the set of currently-live (and next-upcoming-as-fallback)
  fixtures in the landing page "Tournament live" section, with auto-refreshing scores and
  links to each match.

### Modified Capabilities
<!-- No existing spec-level capability changes; the pre-tournament countdown behavior is unchanged. -->

## Impact

- **UI**: `app/[locale]/page.tsx` (landing), `components/tournament-countdown.tsx` (live
  branch now hosts the list) plus a new client list component for polling. Reuses
  `MatchStateBadge`, `TeamFlag`, `KickoffCountdown`, `LocalTime`.
- **Data**: new read query against the existing `matches` table (filter by live / upcoming
  for the active competition). No schema changes.
- **Server**: a server action or `app/api` route returning the live + next-up fixtures as
  JSON for the client poller.
- **i18n**: new keys in `messages/en.json`, `messages/es.json`, `messages/fr.json`.
- **No** breaking changes; no new dependencies.
