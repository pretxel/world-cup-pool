## Why

The admin account is an operator, not a contestant — but today it ranks on the leaderboards and can submit picks and quiz answers like any player. That pollutes the standings (an operator appearing above real players) and lets the admin accrue points it shouldn't. Admins should run the pool, not compete in it.

## What Changes

- **Leaderboards exclude admins.** The overall predictions leaderboard, the per-day leaderboard, and the quiz leaderboard (and the quiz standing/share derived from it) no longer include any profile with `is_admin = true`. Ranks stay contiguous (no gaps where an admin used to sit).
- **Picks: block submit for admins.** On a match's prediction form, an admin sees the score steppers but the submit button is blocked (disabled) with a short note that operators don't compete. The `submitPrediction` server action also rejects admins.
- **Quiz: block answering for admins.** On the daily quiz, an admin sees the question but the answer options are blocked (disabled) with the same note. The `submitQuizAnswer` server action also rejects admins.
- Add a small shared helper to resolve whether the current user is an admin, reused by the pages and the server actions.
- New localized copy (en/es/fr) for the "admins don't compete" notes and the server-side rejection messages.

## Capabilities

### New Capabilities
- `admin-non-participation`: Admin accounts are excluded from all leaderboards and are blocked (UI + server) from submitting predictions and quiz answers.

### Modified Capabilities
<!-- None. The leaderboard/quiz ranking mechanics are unchanged; this adds an admin-exclusion constraint, captured as its own cohesive capability rather than scattered edits across leaderboard/daily-quiz/predictions-lock specs. -->

## Impact

- **Database**: migration `create or replace` for `v_leaderboard_overall`, function `leaderboard_for_day`, and view `v_quiz_leaderboard` — each adds an `is_admin = false` filter inside its aggregate so ranks remain contiguous. `v_quiz_standing` inherits the exclusion (it is built on `v_quiz_leaderboard`); no change needed there.
- **Server actions**: `app/[locale]/(public)/matches/[matchId]/actions.ts` (`submitPrediction`) and `app/[locale]/(public)/quiz/actions.ts` (`submitQuizAnswer`) gain an admin guard.
- **UI**: `prediction-form.tsx` + the match detail page pass/consume an `isAdmin` flag; `answer-card.tsx` + the quiz page likewise.
- **Lib**: new helper (e.g. `lib/admin/current-user.ts`) `isCurrentUserAdmin(supabase)`.
- **i18n**: new strings in `messages/{en,es,fr}.json` for the picks/quiz admin notes and rejection errors.
- **Edge cases**: a rank/share page requested for an admin `user_id` finds no leaderboard row — handled as a normal "no standing" case. No change to scoring, locking, or how non-admins are ranked.
