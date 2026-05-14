## Why

Predictions today lock purely on `kickoff_at > now()`. A match flipped to `final` (or `cancelled`) after kickoff is already in the past, so the time check incidentally blocks edits — but the rule isn't expressed anywhere as "finalized matches are immutable from the user's side." If an admin ever shifts `kickoff_at` to a future timestamp (correction, reschedule edge case, or data import bug), users could overwrite predictions on a match whose result is already known. We want a defense-in-depth lock keyed on match `status`, not just kickoff time, so a finalized match is never editable.

## What Changes

- Predictions locked whenever `matches.status` is `final` or `cancelled`, in addition to the existing kickoff-time lock.
- `lib/match-utils.ts#isLocked` accepts `status` and returns `true` for `final`/`cancelled`/`live` regardless of kickoff.
- RLS policies `predictions_insert_own_before_kickoff` and `predictions_update_own_before_kickoff` extended to also require `m.status = 'scheduled'`.
- Server action `submitPrediction` rejects up front with a clear message when the target match is non-`scheduled`.
- Lock-state messaging on match detail page distinguishes "kickoff has passed" vs "match is final / cancelled".

No breaking change for end users — the lock only becomes *stricter*. No data migration needed.

## Capabilities

### New Capabilities
- `predictions-lock`: rules governing when a user may insert or update a prediction (kickoff timing + match status).

### Modified Capabilities
<!-- none — no existing specs in openspec/specs/ -->

## Impact

- DB: new migration adds tightened RLS policies on `public.predictions` (drop + recreate the two before-kickoff policies).
- Code: `lib/match-utils.ts`, `app/(public)/matches/[matchId]/page.tsx`, `app/(public)/matches/[matchId]/actions.ts`, `app/(app)/my-picks/page.tsx`.
- Tests: extend prediction lock tests in `tests/` to cover `status='final'` + future `kickoff_at` case.
- No new deps. No public API changes beyond the server action's expanded error string.
