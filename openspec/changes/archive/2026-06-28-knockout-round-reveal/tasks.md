## 1. Format schema

- [x] 1.1 In `lib/competition-schema.ts`, add `revealed: z.boolean().default(false)` to `stageSchema`.
- [x] 1.2 Add a pure helper `revealedKnockoutStageKeys(format: CompetitionFormat): Set<string>` returning the `key`s of stages with `kind === "knockout"` and `revealed === true`. Export for reuse + tests.

## 2. Public list gating

- [x] 2.1 In `app/[locale]/(public)/matches/page.tsx`, load the active competition format and compute `revealed = revealedKnockoutStageKeys(format)`.
- [x] 2.2 Change the visibility gate from `filter(isConfirmedMatch)` to `filter(m => isConfirmedMatch(m) || revealed.has(m.stage))`. Keep stats, team filter, and day grouping operating on this visible set.
- [x] 2.3 Pass a per-row `confirmed = isConfirmedMatch(m)` flag to the matches list row.

## 3. Read-only row rendering

- [x] 3.1 In the matches list row component, when `confirmed` is false: render placeholder participant text without a flag (no `flagSlug` crash), suppress the "Pick"/closing-soon CTA, and show a "teams TBD" affordance. Confirmed rows unchanged.
- [x] 3.2 Ensure team-filter / `matchInvolvesTeam` and status bucketing tolerate placeholder names (no throw; placeholders simply don't match a country filter).

## 4. Admin toggle

- [x] 4.1 In `app/[locale]/(admin)/admin/matches/actions.ts`, add `toggleKnockoutRoundReveal(formData)`: `assertAdmin`, resolve the managed competition, `parseFormatConfig`, set `revealed` on the target knockout stage (by `key`, from a form field), write the updated `format_config` back via the service-role client, and `revalidatePath` `/matches` + `/admin/matches`.
- [x] 4.2 In `app/[locale]/(admin)/admin/matches/page.tsx`, render the managed competition's knockout stages each with a reveal toggle (current state + submit). Group/league stages are not shown.

## 5. i18n

- [x] 5.1 Add admin labels (section title, per-round "Reveal"/"Hide", revealed/hidden state) to the admin namespace in `messages/en.json`, `es.json`, `fr.json`, `de.json`.
- [x] 5.2 Add a public "teams TBD" / not-confirmed row label across all locales.

## 6. Verify

- [x] 6.1 Unit tests: `revealedKnockoutStageKeys` returns only revealed knockout stage keys (ignores group/league and unrevealed); `stageSchema` defaults `revealed` to false when absent.
- [x] 6.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm test` and confirm they pass.
- [ ] 6.3 Manually verify: with a round hidden, its placeholder fixtures are absent from `/matches`; after an admin reveals it, they appear read-only with date/venue and no "Pick"; their detail still shows "teams not confirmed yet"; confirmed fixtures remain pickable; hiding the round removes them again. (Blocked: needs an admin session to toggle the round — not auto-run; logic covered by unit tests + full suite.)
