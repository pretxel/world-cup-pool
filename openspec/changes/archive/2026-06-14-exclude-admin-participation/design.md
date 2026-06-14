## Context

`profiles.is_admin boolean` already exists and gates the `/admin` area. Three ranking surfaces currently include every profile:
- `public.v_leaderboard_overall` (view) — overall predictions standings.
- `public.leaderboard_for_day(d date, tz text)` (function) — per-day standings.
- `public.v_quiz_leaderboard` (view) — quiz standings; `public.v_quiz_standing` is built on top of it.

All three share the same shape: an `agg` CTE that groups scores/answers by `user_id`, then a final `select` that computes `rank() over (...)` and joins `public.profiles`. Submissions go through two server actions: `submitPrediction` (matches/[matchId]/actions.ts) and `submitQuizAnswer` (quiz/actions.ts, which calls the `answer_quiz` SECURITY DEFINER RPC). The match detail page and quiz page already load the current `user`.

## Goals / Non-Goals

**Goals:**
- Admins never appear on any leaderboard; ranks stay contiguous.
- Admins cannot submit picks or quiz answers — blocked in the UI and enforced on the server.
- Reuse one admin-check helper across pages and actions.

**Non-Goals:**
- Hiding the leaderboard/quiz from admins (they can still view).
- Removing existing admin scores/answers data (exclusion is at read/rank time; historical rows are simply not ranked).
- Per-competition or per-role granularity beyond the existing `is_admin` flag.

## Decisions

### Exclude admins inside the aggregate, not the final join
Add `and pr.is_admin = false` by joining `public.profiles` **inside each `agg` CTE** (filtering before `rank()` is computed). Filtering at the final profiles join instead would drop the admin row *after* ranking and leave a gap (e.g. 1, 3, 4). One migration does `create or replace` for `v_leaderboard_overall`, `leaderboard_for_day`, and `v_quiz_leaderboard`, re-declaring each body with the added filter. `v_quiz_standing` needs no change — its final select reads from `v_quiz_leaderboard`, so the exclusion cascades. Row shapes, grants, and signatures are unchanged.
*Alternative considered:* filter in application code after fetching. Rejected — would have to be repeated in every consumer (leaderboard page, quiz page, OG cards, share pages) and re-rank client-side; the view is the single correct chokepoint.

### Defense in depth: UI block + server guard
"Block the button" is the visible behavior, but a disabled button is not security. Each server action additionally checks the caller's `is_admin` and returns an error before writing. For predictions this is a plain check in `submitPrediction`. For the quiz, the check goes in `submitQuizAnswer` before the `answer_quiz` RPC call. (RLS already scopes writes to `auth.uid()`; this adds the admin-specific refusal with a clear message rather than a generic failure.)
*Alternative considered:* enforce via RLS/RPC only. Rejected — the action-level guard gives a precise, localized error and keeps the rule visible in app code; a DB-level guard could be added later but is not required for this change.

### Shared `isCurrentUserAdmin` helper
Add `lib/admin/current-user.ts` exporting `isCurrentUserAdmin(supabase): Promise<boolean>` (resolves the signed-in user, selects `is_admin`, returns false when signed-out or on error). Used by the match detail page, quiz page, and both actions — avoids four copies of the same `select('is_admin')`.

### UI: disable, don't hide
- **Picks:** the match page passes `isAdmin` to `PredictionForm`; when true the submit button is disabled and a note renders (steppers may stay interactive but cannot be saved). Keeps the page layout stable and the message clear.
- **Quiz:** the quiz page passes `isAdmin` to `AnswerCard`; when true the option buttons are disabled and the same note renders. The existing `signedIn` gating pattern is the model.

## Risks / Trade-offs

- **Admin already has historical scores/answers** → They simply stop being ranked; no data deleted. Mitigation: acceptable and reversible (drop the filter to restore).
- **Rank/share deep-link for an admin `user_id`** → No leaderboard row exists, so the share/rank page must treat it as "no standing" rather than erroring. Mitigation: verify those pages already handle a missing row (they look up by id and can 404 / show empty); adjust if needed.
- **Two enforcement points (UI + server) drift** → Both derive from the same `isCurrentUserAdmin` helper, minimizing divergence.
- **View recreation** → `create or replace view` preserves grants/dependents; `v_quiz_standing` depends on `v_quiz_leaderboard` but the column list is unchanged, so the replace succeeds without dropping dependents.

## Migration Plan

1. Add a migration that `create or replace`s the two views and the function with the `is_admin = false` filter in each aggregate.
2. Push to the linked DB; verify an admin disappears from all three surfaces and ranks are contiguous.
3. Ship the helper, action guards, UI flags/notes, and i18n strings.
4. Rollback: re-run the previous definitions (drop the `is_admin` filter); remove the action guards/UI flags. No data migration involved.
