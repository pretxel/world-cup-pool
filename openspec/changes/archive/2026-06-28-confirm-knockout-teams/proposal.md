## Why

The group stage is finishing and the Round of 32 is set, but each R32 fixture still stores placeholder participants ("Winner Group A", "2nd Group B", "3rd Group C/E/F/H/I"). Until both sides resolve to real countries a match is *unconfirmed* — hidden from `/matches` and unpickable. Confirming all 16 by hand on the admin detail page is slow and error-prone, even though the system already knows the answers: the bracket resolver derives each R32 team from the real group standings. One admin click should stamp those confirmed teams onto the fixtures, which (via the existing confirmed-match rules) makes them appear and become pickable through each kickoff — exactly the "picks open from 28/06" behavior, with no new gate.

## What Changes

- Add an admin **"Confirm knockout teams"** action on `/admin/matches` that fills each resolvable knockout fixture's real `home_team` / `away_team` from the computed bracket (the same `bracket-core` resolution used by `/bracket`), replacing placeholders in one pass.
- Only **confirmed** resolutions are written (the source group(s) have completed), never provisional ones, so a team is stamped only when it is final. In effect this confirms the Round of 32 now; later rounds fill on subsequent runs as their feeder matches finalize.
- The action is **idempotent** and reports how many fixtures it updated; re-running only touches still-unconfirmed slots.
- No change to pick timing or lock rules: once a fixture's teams are confirmed it is pickable until its kickoff (R32 kickoffs run 28 Jun–4 Jul), satisfying "enable the pick after 28/06" through existing behavior.

## Capabilities

### New Capabilities

- `knockout-team-autofill`: an admin-triggered, idempotent action that stamps confirmed knockout participants onto fixtures by deriving them from the live bracket resolution, so placeholder fixtures become confirmed (and therefore pickable) without per-fixture manual editing.

### Modified Capabilities

_None._ Picks remain governed by `predictions-lock` and `match-availability` (a confirmed, scheduled, future-kickoff match is pickable) — this change only confirms teams; it does not alter when picks open or lock.

## Impact

- **Code (new)**
  - `lib/admin/confirm-knockout-teams.ts` — pure `computeKnockoutTeamUpdates(matches)` (buildBracket → confirmed-only diffs) + a thin dispatcher that applies the updates via the service-role client.
- **Code (modified)**
  - `app/[locale]/(admin)/admin/matches/actions.ts` — new `confirmKnockoutTeams` server action (admin-gated, managed-competition scoped), mirroring the existing "Sync now" action: apply updates, revalidate, surface a summary.
  - `app/[locale]/(admin)/admin/matches/page.tsx` — a "Confirm knockout teams" control next to "Sync now".
- **Data**: updates existing `public.matches.home_team` / `away_team`; no schema change.
- **i18n**: admin labels (button, result summary) across en/es/fr/de.
- **Reuses**: `buildBracket` (`lib/bracket-core.ts`), `isConfirmedMatch` (`lib/match-utils.ts`). No impact on the scorer, cron jobs, or other surfaces.
