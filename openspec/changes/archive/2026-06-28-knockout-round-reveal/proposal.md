## Why

The public `/matches` list shows only *confirmed* fixtures (both teams real), so knockout rounds stay invisible until their teams are filled in. Players can't see the upcoming knockout schedule — dates and venues for the Round of 32, Round of 16, etc. — even though those fixtures and kickoff times are known. The pool owner wants to reveal a knockout round on demand so its matches appear on `/matches` (as a read-only schedule) ahead of team confirmation, round by round as the tournament unfolds.

## What Changes

- Add a per-round **reveal toggle** in the admin matches surface: an admin can enable/disable each knockout stage (R32, R16, QF, SF, Final, third place) for the managed competition.
- When a knockout round is revealed, its fixtures appear on the public `/matches` list even with placeholder participants ("Winner Group A"), showing the schedule (date, venue, stage) as **read-only** rows.
- A revealed-but-unconfirmed fixture is **visible, not pickable**: no "Pick" affordance on the list, and the detail page keeps its existing "teams not confirmed yet" state (no prediction form). Pickability is unchanged — it still requires confirmed real teams, `scheduled` status, and a future kickoff.
- A round that is not revealed behaves exactly as today (its unconfirmed fixtures stay hidden); confirmed fixtures always show regardless of the toggle.

## Capabilities

### New Capabilities

- `knockout-round-reveal`: an admin-controlled, per-knockout-stage reveal flag (stored in the competition format) that surfaces a round's fixtures on the public matches list before their teams are confirmed.

### Modified Capabilities

- `match-availability`: the public `/matches` list shows a fixture when it is confirmed **or** its knockout round is revealed; a revealed-but-unconfirmed fixture renders read-only and remains unpickable. The pick gate (confirmed teams) is unchanged.

## Impact

- **Code (modified)**
  - `lib/competition-schema.ts` — add optional `revealed: boolean` (default false) to `stageSchema`; a helper to read revealed knockout stage keys from a format.
  - `app/[locale]/(public)/matches/page.tsx` — load the active competition format; gate the list to `confirmed OR revealed-knockout-round` instead of confirmed-only; pass a per-row "confirmed/pickable" flag.
  - the matches list row component — render unconfirmed (placeholder) knockout rows read-only: no flag/crash on placeholder names, no "Pick" CTA, a "teams TBD" affordance.
  - `app/[locale]/(admin)/admin/matches/{actions.ts,page.tsx}` — a `toggleKnockoutRoundReveal` action (flips the stage's `revealed` flag in the managed competition's `format_config`) and per-round toggle controls.
- **Data**: the reveal flag lives in `competitions.format_config` (JSONB) — no schema/table change.
- **i18n**: admin toggle labels and a public "teams TBD" / not-yet-confirmed row label across en/es/fr/de.
- **Unchanged**: `predictions-lock`, prediction submission rejection of unconfirmed matches, the scorer, and the bracket page.
