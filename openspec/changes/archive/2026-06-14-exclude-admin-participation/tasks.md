## 1. Database — exclude admins from leaderboards

- [x] 1.1 Add a migration that `create or replace`s `public.v_leaderboard_overall`, adding a `join public.profiles` filtered to `is_admin = false` inside the `agg` CTE (so `rank()` is computed over non-admins and ranks stay contiguous).
- [x] 1.2 In the same migration, `create or replace` `public.leaderboard_for_day(date, text)` with the same `is_admin = false` filter inside its `agg` CTE; keep the signature and `grant execute` intact.
- [x] 1.3 In the same migration, `create or replace` `public.v_quiz_leaderboard` with the `is_admin = false` filter inside its `agg` CTE; keep `grant select` intact. (`v_quiz_standing` inherits the exclusion — no change.)
- [x] 1.4 Push the migration to the linked DB and confirm: an admin no longer appears in `v_leaderboard_overall`, `leaderboard_for_day`, or `v_quiz_leaderboard`, and ranks are contiguous. Regenerate `lib/database.types.ts` if anything changed (view shapes are unchanged, so likely a no-op).

## 2. Admin-check helper

- [x] 2.1 Add `lib/admin/current-user.ts` exporting `isCurrentUserAdmin(supabase): Promise<boolean>` — resolves the signed-in user, selects `profiles.is_admin`, returns `false` when signed-out or on error.

## 3. Picks — block submission for admins

- [x] 3.1 In `submitPrediction` (`app/[locale]/(public)/matches/[matchId]/actions.ts`), after resolving the user, reject admins with a localized error before any write.
- [x] 3.2 Pass an `isAdmin` flag from the match detail page (`matches/[matchId]/page.tsx`) into `PredictionForm` (compute via the helper).
- [x] 3.3 In `prediction-form.tsx`, when `isAdmin` is true, disable the submit button and render a note that operator accounts don't compete.

## 4. Quiz — block answering for admins

- [x] 4.1 In `submitQuizAnswer` (`app/[locale]/(public)/quiz/actions.ts`), after resolving the user, reject admins with an error before calling the `answer_quiz` RPC.
- [x] 4.2 Pass an `isAdmin` flag from the quiz page (`quiz/page.tsx`) into `AnswerCard` (compute via the helper).
- [x] 4.3 In `answer-card.tsx`, when `isAdmin` is true, disable the answer option buttons and render the same "admins don't compete" note.

## 5. Internationalization

- [x] 5.1 Add the admin-note + rejection strings to `messages/en.json` (e.g. `predictionForm.adminBlocked`, an admin error for the pick action; `quiz.adminBlocked` + answer-action error).
- [x] 5.2 Add Spanish translations to `messages/es.json`.
- [x] 5.3 Add French translations to `messages/fr.json`.

## 6. Verification

- [x] 6.1 Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`; fix any issues.
- [ ] 6.2 Manually verify with an admin account: absent from all leaderboards (contiguous ranks), pick submit button blocked + server rejects a direct call, quiz options blocked + server rejects a direct call; and a non-admin player is unaffected. _(Leaderboard exclusion verified live on the remote DB: 1 admin profile, 0 admins in `v_leaderboard_overall` and `v_quiz_leaderboard`, ranks contiguous. The UI button-block + server-action rejection are code-verified — typecheck/lint/468 tests green — but the in-browser admin-session walkthrough still needs a manual pass with admin + non-admin logins.)_
