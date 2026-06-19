## 1. Add CTA copy to i18n

- [x] 1.1 Add new keys to the `leaderboard` namespace for the CTA heading, body/label, and link text (e.g. `inviteCtaTitle`, `inviteCtaBody`, `inviteCtaLink`).
- [x] 1.2 Translate the new keys across all supported locales (`en`, `es`, `fr`, `de`).

## 2. Render the CTA on the leaderboard page

- [x] 2.1 In `app/[locale]/(public)/leaderboard/page.tsx`, add an "invite friends / create a group" CTA gated on the signed-in `user`, placed near the player's own context (alongside the existing `myRow` "share your rank" section).
- [x] 2.2 Link the CTA to `localePath(locale, "/groups")` using the existing `Link`/`ArrowRightIcon` and dashed-card / link styling already used on the page; reuse the new `leaderboard` translation keys.
- [x] 2.3 Ensure the CTA renders both when the user is on the board (`myRow`) and when they are signed in but not yet ranked, and does not render for signed-out visitors or alter the empty-state branch.
- [x] 2.4 Leave `components/leaderboard-table.tsx` presentational (no CTA inside it) so the per-group mini board is unaffected; do not modify `lib/groups.ts`, group actions, or `v_leaderboard_overall`.

## 3. Verify

- [x] 3.1 Run the project's typecheck and lint and confirm no new errors.
- [x] 3.2 Run the test suite and confirm it passes.
- [x] 3.3 Manual check: as a signed-in user on the board, confirm the CTA shows near your row and navigates to the locale-prefixed `/groups`; as a signed-in user not yet ranked, confirm it still shows; signed out, confirm it is hidden and the empty state is unchanged.
- [x] 3.4 Run `openspec validate "leaderboard-invite-cta"` (and `openspec verify --change leaderboard-invite-cta` / `/opsx:verify`) to confirm the change is valid before archiving.
