## 1. Core logic

- [x] 1.1 Create `lib/admin/confirm-knockout-teams.ts` with a pure `computeKnockoutTeamUpdates(matches: BracketMatchInput[]): KnockoutTeamUpdate[]` that runs `buildBracket`, walks every knockout fixture/round, and emits `{ id, home_team?, away_team? }` for each side whose resolved participant has `status === "confirmed"`, has a real team, and differs from the stored value. Group-stage rows ignored; sides with no confirmed change omitted.
- [x] 1.2 Add a thin server-side `applyKnockoutTeamConfirmation(competitionId)` that loads the competition's matches via the service-role admin client, calls `computeKnockoutTeamUpdates`, applies each update by `id`, and returns `{ updated, fixtures }` (fixtures = labels of changed rows). Mark `server-only`.

## 2. Admin action + UI

- [x] 2.1 In `app/[locale]/(admin)/admin/matches/actions.ts`, add a `confirmKnockoutTeams` server action mirroring the "Sync now" action: `assertAdmin`, resolve the managed competition, call `applyKnockoutTeamConfirmation`, `revalidatePath`/`revalidateTag` the match surfaces (`/matches`, `/admin/matches`, bracket), and redirect back with the summary in query params (or return it for inline display).
- [x] 2.2 In `app/[locale]/(admin)/admin/matches/page.tsx`, add a "Confirm knockout teams" submit control next to "Sync now", wired to the new action, showing the updated-count result inline like the existing sync summary.

## 3. i18n

- [x] 3.1 Add admin labels (button "Confirm knockout teams", running, result "Confirmed N fixtures", zero-update message) to the relevant admin namespace in `messages/en.json`, `es.json`, `fr.json`, `de.json`.

## 4. Verify

- [x] 4.1 Unit tests for `computeKnockoutTeamUpdates`: writes a confirmed R32 group slot; skips a provisional best-third slot; skips an unresolved later-round slot; emits nothing when the stored team already equals the confirmed resolution (idempotent); ignores group-stage rows.
- [x] 4.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm test` — all pass (typecheck clean; lint pre-existing warnings only; 1022/1022 tests).
- [ ] 4.3 Manually verify in admin: after group results exist, "Confirm knockout teams" stamps the R32 real teams, the fixtures appear on `/matches`, their detail pages show the prediction form before kickoff, and a second run reports zero updates. (Blocked: needs an admin session and writes real teams to fixtures — not auto-running a prod data mutation.)
