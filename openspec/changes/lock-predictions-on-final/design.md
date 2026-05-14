## Context

Current prediction lock has a single key: `kickoff_at > now()`. Used in three places:

1. `lib/match-utils.ts#isLocked(match)` — UI guard, only inspects `kickoff_at`.
2. `app/(public)/matches/[matchId]/page.tsx` — picks the `PredictionForm` vs the locked banner based on `isLocked`.
3. RLS policies `predictions_insert_own_before_kickoff` and `predictions_update_own_before_kickoff` in `supabase/migrations/20260513000000_init.sql` — DB-side enforcement via `m.kickoff_at > now()`.

Status flow on `matches`: `scheduled → live → final` (admin can also flip to `cancelled`). Trigger `trg_recompute_scores_on_match_change` already keys off `status` to recompute `public.scores`. So the DB already knows what "final" means.

Because `final` is only reached *after* kickoff, the time-based lock incidentally covers it today. The risk this design addresses is the kickoff-time being mutated (admin correction, reschedule, data fix) on a match that has already been finalized — predictions would re-open and users could overwrite a known result. We need the lock to also key on `status`, so a finalized/cancelled match is permanently immutable regardless of timing.

## Goals / Non-Goals

**Goals:**
- Predictions are locked when `status ∈ {live, final, cancelled}` regardless of `kickoff_at`.
- Enforcement at both the RLS layer (defense in depth) and the server action (clear user-facing error message).
- UI surfaces "match is final" / "match cancelled" instead of "kickoff has passed" when status drives the lock.
- No regression for the existing kickoff-time path.

**Non-Goals:**
- Unlock predictions on admin-reverted finals. If admin flips `final → scheduled`, predictions stay locked unless `kickoff_at` is also pushed back into the future — this is intentionally conservative and outside scope.
- Changes to the scoring trigger or score table.
- A general-purpose "match state machine" abstraction. Single rule, single place.

## Decisions

**1. Lock when `status != 'scheduled'`, not just on `status = 'final'`.**

Alternatives considered:
- *Lock only on `status = 'final'`*: misses `live` matches whose `kickoff_at` was somehow set in the future. `live` already means the game is in progress — predictions there are nonsensical.
- *Lock on `status IN ('final','cancelled')`*: leaves `live` reliant on the time check. Same gap as above.

Chosen rule: a prediction may be inserted/updated only when `status = 'scheduled' AND kickoff_at > now()`. Both conditions must hold.

**2. Enforce at RLS, mirror at server action.**

RLS is the source of truth (a misbehaving client cannot bypass it). The server action still pre-checks so we can return a friendly error string instead of relying on the generic `42501` row-level-security message. The action's existing `42501` fallback message ("Predictions are locked — kickoff has passed.") becomes a fallback when neither pre-check matched.

**3. `isLocked` keeps a single boolean return.**

Alternatives considered:
- *Return a discriminated union `{ locked: true; reason: 'kickoff' | 'final' | 'cancelled' | 'live' }`*: more expressive but every call site only needs the boolean today.
- *Add a separate `lockReason(match)` helper*: cleaner separation. Pick this — small helper, no breaking change to `isLocked`, used by the match detail page for the banner copy.

`isLocked(match)` extended signature: `Pick<MatchRow, "kickoff_at" | "status">`.

**4. DB migration: drop + recreate the two policies.**

Postgres has no `ALTER POLICY ... USING` for changing the predicate, so we drop and recreate. Wrap in a single transaction (`begin; ... commit;` — Supabase migrations are already transactional per file).

**5. Server action error mapping.**

Pre-check fetches `status` + `kickoff_at` for the match:
- `status = 'final'` → `"Predictions are locked — match is final."`
- `status = 'cancelled'` → `"Predictions are locked — match was cancelled."`
- `status = 'live'` → `"Predictions are locked — match is live."`
- otherwise `kickoff_at <= now()` → `"Predictions are locked — kickoff has passed."`

## Risks / Trade-offs

- **Risk**: extra `select` on `matches` in `submitPrediction` adds one round-trip → **Mitigation**: single indexed PK lookup, negligible; also avoids a confusing generic RLS error.
- **Risk**: admin flips `final → scheduled` for a correction and users expect to re-edit → **Mitigation**: documented Non-Goal; admin would need to also reset `kickoff_at` (current flow already requires that to "reopen" a match).
- **Risk**: existing tests assume "kickoff has passed" error string → **Mitigation**: update tests; the lock-on-final case is a new assertion, not a renamed one.

## Migration Plan

1. New migration file `supabase/migrations/<ts>_lock_predictions_on_final.sql`:
   - `drop policy ... ; create policy ...` for both insert + update policies, adding `m.status = 'scheduled'` to the predicate.
2. Code changes in the same PR (no feature-flagging — purely tightening).
3. Rollback: revert the migration (drop new policies, recreate old ones from the init migration); no data backfill needed.

## Open Questions

None — clarification not required; the rule is conservative and reversible.
