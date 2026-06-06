## 1. Confirmation helper (lib/match-utils.ts)

- [x] 1.1 Add `isConfirmedMatch(match: { home_team: string; away_team: string }): boolean` returning true iff `flagSlug(home_team)` and `flagSlug(away_team)` are both non-null
- [x] 1.2 Extend `tests/match-utils.test.ts`: both-real → true; one placeholder → false; both placeholders → false

## 2. Public list gating (app/[locale]/(public)/matches/page.tsx)

- [x] 2.1 After fetching `list`, derive `confirmed = list.filter(isConfirmedMatch)` and use it as the base list for team-filter input, `filterableTeams`, stats, day groups, and empty state
- [x] 2.2 Verify the team-filter chips and `?team=` behavior still work over the gated base (no placeholder leakage)

## 3. Detail + prediction gating

- [x] 3.1 In `matches/[matchId]/page.tsx`, compute `confirmed = isConfirmedMatch(match)`; when false, render a localized "teams not confirmed yet" card in the prediction section and skip the sign-in/lock/`PredictionForm` ladder
- [x] 3.2 In `matches/[matchId]/actions.ts`, select `home_team, away_team` and reject `submitPrediction` for an unconfirmed match with a localized error before the upsert

## 4. Admin edit form + indicator (app/[locale]/(admin)/admin/matches/page.tsx)

- [x] 4.1 Add a per-match edit `<form action={saveFixture}>` with hidden `id` and prefilled `stage`, `group_code`, `home_team`, `away_team`, `kickoff_at` (UTC wall-clock slice for datetime-local), `venue`
- [x] 4.2 Show an "Unconfirmed" badge on rows where `!isConfirmedMatch(m)`
- [x] 4.3 Confirm the edit uses the `saveFixture` UPDATE branch (no future-kickoff guard) and revalidates `/matches` + `/admin/matches`

## 5. Localization

- [x] 5.1 Add `matches`/`predictionForm` keys for the detail not-confirmed card and the action rejection error to `messages/en.json`
- [x] 5.2 Add `admin` keys for the edit form (edit heading, save edit) and the "Unconfirmed" badge to `messages/en.json`
- [x] 5.3 Mirror all new keys in `messages/es.json` and `messages/fr.json` (i18n parity test enforces identical key sets)

## 6. Verify

- [x] 6.1 Run tests, typecheck, lint, build; fix failures
- [ ] 6.2 Manually verify: `/matches` hides placeholder fixtures; an unconfirmed detail page shows the not-confirmed state with no form; admin edit sets teams and the fixture then appears publicly; en/es/fr
