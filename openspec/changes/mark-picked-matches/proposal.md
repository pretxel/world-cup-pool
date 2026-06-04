## Why

A signed-in player browsing the matches list can't tell which fixtures they've already predicted — they have to open each match to check. A pick indicator on the list lets them see at a glance what's left to pick before kickoff.

## What Changes

- On the matches list (`/[locale]/matches`), show a "picked" check badge on every row the **authenticated** user has already submitted a prediction for.
- The indicator is only computed/rendered when a user is signed in; anonymous visitors see the list exactly as before (no badge, no extra query).
- Add a small accessible label (`matches.rowPicked`) for the badge, localized in en/es/fr.

Non-goals: showing the picked scoreline on the list (stays on the match page), any change to the pick/lock flow, marking picks on other views (my-picks already lists them), or a "not yet picked" counter.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `match-presentation`: add a requirement that the matches list marks rows the signed-in user has already predicted.

## Impact

- **App**: `app/[locale]/(public)/matches/page.tsx` — resolve the current user, and when signed in fetch their predicted `match_id`s into a Set; pass a `picked` flag to each row.
- **Component**: the in-file `MatchRowCard` gains a `picked` prop and renders a check badge (e.g. `CheckCircle2Icon`) when true.
- **i18n**: `matches.rowPicked` added to `messages/{en,es,fr}.json`.
- **Data**: one extra `predictions` select (`match_id` where `user_id = auth.uid()`) only for signed-in requests; covered by the existing `predictions_select_own` RLS policy — no schema or policy change.
