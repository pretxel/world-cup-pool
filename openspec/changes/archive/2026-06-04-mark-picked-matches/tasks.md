## 1. Data

- [x] 1.1 In `app/[locale]/(public)/matches/page.tsx`, resolve the current user with `supabase.auth.getUser()`
- [x] 1.2 When a user exists, query `predictions.select("match_id").eq("user_id", user.id)` and build a `Set<string>` of predicted match ids; skip the query entirely when signed out

## 2. Presentation

- [x] 2.1 Add a `picked: boolean` prop to the in-file `MatchRowCard` and pass `picked={pickedIds.has(m.id)}` from the row map
- [x] 2.2 Render a check badge (`CheckCircle2Icon`) near the existing stage/status badges when `picked` is true; visible localized text exposes the label to assistive tech, icon is `aria-hidden`
- [x] 2.3 Thread a `tPicked` value (`t("rowPicked")`) into the card like the other row strings

## 3. i18n

- [x] 3.1 Add `matches.rowPicked` to `messages/en.json`
- [x] 3.2 Mirror `matches.rowPicked` in `messages/es.json` and `messages/fr.json`

## 4. Verify

- [x] 4.1 `pnpm typecheck` and `pnpm lint` clean (64/64 tests pass)
- [ ] 4.2 Signed out: `/matches` shows no picked indicators and issues no prediction query — runtime check, needs deploy/browser
- [ ] 4.3 Signed in: rows for predicted fixtures show the badge; un-predicted rows do not — runtime check, needs signed-in session
