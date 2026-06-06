## Why

The seeded schedule includes all 104 fixtures, but the 32 knockout matches carry placeholder participants (`"2nd Group A"`, `"3rd Group A/B/C/D/F"`, …) because the real teams aren't known until the group stage resolves. Showing those placeholder fixtures publicly is noise — visitors can't meaningfully read or predict a match between two unknown teams — and there is currently no admin affordance to set the real teams once they are decided.

## What Changes

- **Public `/matches` list shows only confirmed matches.** A match is *confirmed* when both `home_team` and `away_team` resolve to a real participating country (via the existing team→flag mapping). Placeholder knockout fixtures are hidden until their teams are set. Header stats and day-group counts reflect the confirmed set.
- **Unconfirmed match detail pages are gated.** `/matches/[matchId]` for an unconfirmed match renders a "teams not confirmed yet" state instead of the scoreboard pick area, and shows no prediction form.
- **Prediction submission rejects unconfirmed matches.** The `submitPrediction` server action refuses writes for a match whose teams aren't both confirmed (defense in depth behind the hidden form).
- **Admin can edit a match's teams (and fixture fields).** The `/admin/matches` page gains a per-match edit form (reusing the existing `saveFixture` update path) to set/correct `home_team`, `away_team`, `stage`, `group_code`, `kickoff_at`, and `venue`. Each match row shows an **Unconfirmed** indicator when either team is still a placeholder, so admins can find the fixtures that need attention.
- Localize all new UI strings (admin edit form, detail "not confirmed" state, unconfirmed badge) across all locales.

Once an admin fills a knockout match's real teams, it becomes confirmed and appears on the public list and as a pickable match automatically — no separate publish step.

## Capabilities

### New Capabilities
- `match-availability`: Confirmed-team gating of the public surface — which matches appear on the `/matches` list, whether a match detail page is pickable, and whether `submitPrediction` accepts a write — all driven by whether both teams resolve to real countries.
- `admin-fixture-editing`: Admin per-match editing of fixture fields (teams, stage, group, kickoff, venue) with a visible indicator for matches whose teams are not yet confirmed.

### Modified Capabilities
<!-- match-team-filter still filters whatever list is shown; its requirements are unchanged (the base list is simply pre-gated to confirmed matches, and filterableTeams already only surfaces real countries). predictions-lock (status/kickoff RLS) is unchanged — the confirmed-team gate is a separate, additional condition enforced at the action/UI layer, not a change to the existing lock. No existing spec requirements change. -->

## Impact

- **Code**:
  - `lib/match-utils.ts` — add `isConfirmedMatch(match)` (both teams resolve via `flagSlug`).
  - `app/[locale]/(public)/matches/page.tsx` — gate the base list to confirmed matches before team-filtering, stats, and day-grouping.
  - `app/[locale]/(public)/matches/[matchId]/page.tsx` — render a not-confirmed state for unconfirmed matches; suppress the pick form.
  - `app/[locale]/(public)/matches/[matchId]/actions.ts` — reject `submitPrediction` for unconfirmed matches.
  - `app/[locale]/(admin)/admin/matches/page.tsx` — per-match edit form + unconfirmed indicator.
- **i18n**: new keys in `matches`, `predictionForm`, and `admin` namespaces across `messages/{en,es,fr}.json`.
- **APIs / DB**: none. No migration; "confirmed" is derived from the team strings, not a stored column. `saveFixture`'s update branch already exists and is reused.
- **Dependencies**: none new.
