## Context

Current admin flow for entering a result lives in `app/(admin)/admin/matches/actions.ts#setMatchResult`:

```ts
await admin.from("matches").update({ home_score, away_score, status }).eq("id", match_id);
revalidatePath(...);
```

The DB-side recompute is triggered by `trg_recompute_scores_on_match_change`:

```sql
if (tg_op = 'UPDATE' and (
      new.home_score is distinct from old.home_score
   or new.away_score is distinct from old.away_score
   or new.status     is distinct from old.status
)) or tg_op = 'INSERT' then
  perform public.compute_match_scores(new.id);
end if;
```

`compute_match_scores` itself is safe to call repeatedly: it deletes all rows in `public.scores` for the match and re-inserts based on the current `matches` row. If `status <> 'final'` or scores are null, it just leaves the table empty after the delete.

There is also a `forceRecompute` admin action that exists exactly to handle the "trigger didn't fire because nothing changed" case. We can absorb its job into `setMatchResult` for the final-save path, so the admin doesn't need to know two buttons exist.

## Goals / Non-Goals

**Goals:**
- Re-saving the same final values still rebuilds `public.scores`.
- Admin doesn't have to think about which button to press to refresh the leaderboard.
- `/my-picks` and `/leaderboard` reflect the recomputed scores on the next page load.

**Non-Goals:**
- Don't remove the existing trigger — it's still the right thing for direct SQL writes / future automation.
- Don't remove the `forceRecompute` admin action — it stays as an escape hatch for non-final matches or per-match nudges.
- Don't validate "status='final' requires non-null scores" — separate concern, not in scope here. (Existing behavior: a final-with-null-scores save clears scores. Owner can address later.)
- No UI changes.

## Decisions

**1. Call `compute_match_scores` from the server action, always, after a successful UPDATE.**

Alternatives considered:
- *Call only when `status === 'final'`*: avoids redundant work for non-final saves, but `compute_match_scores` on a non-final match is a single DELETE on an indexed column — cheap and clearly safe. Calling unconditionally keeps the code one branch shorter and removes a class of "I changed status to scheduled and stale scores stuck around" bugs.
- *Change the DB trigger to fire on every UPDATE regardless of `is distinct from`*: would affect every match update (admin fixture edits to venue/kickoff would recompute), which is wasted DB work. Tighter scope to fix it in the action.

Chosen: unconditional RPC call after the UPDATE in `setMatchResult`.

**2. Use the admin Supabase client (service role) for the RPC.**

The existing init migration grants `execute` on `compute_match_scores(uuid)` to `authenticated`, so a regular admin user *could* call it via their JWT. We already have `createAdminSupabaseClient()` in scope for the UPDATE; reusing it for the RPC keeps a single connection and avoids depending on the per-user grant.

**3. Error handling — surface RPC failure, do not silently swallow.**

If the UPDATE succeeds but the RPC fails, the admin should see a clear error. We `throw new Error(...)` consistent with the rest of the action's failures. The match row is already updated by that point — that's acceptable: the trigger may have already recomputed scores on the column change, and the admin can hit "Save result" again or use "Force recompute scores" as a fallback. Document this in the design but don't over-engineer.

**4. Revalidate `/my-picks` too.**

Current action revalidates `/matches/[matchId]`, `/matches`, and `/leaderboard`. Score recomputes also affect `/my-picks` (per-row points + totals). Adding `revalidatePath("/my-picks")` so users see updated points on next view.

## Risks / Trade-offs

- **Risk**: every result save now incurs one extra DB round-trip → **Mitigation**: cheap RPC (single DELETE + single INSERT-FROM-SELECT, both indexed); admin path is low-traffic.
- **Risk**: UPDATE succeeds, RPC fails → scores partially stale → **Mitigation**: trigger will have already run on the column change in most real cases; admin can re-save or use `forceRecompute`. Error is surfaced.
- **Risk**: Calling on non-final saves wipes `scores` for that match (existing trigger behavior, just made more explicit) → **Mitigation**: this matches the documented semantics of `compute_match_scores`; non-final matches shouldn't have score rows anyway.

## Migration Plan

1. Edit `app/(admin)/admin/matches/actions.ts#setMatchResult` — add the RPC call + extra revalidate.
2. Tests in `tests/`.
3. No DB migration. Rollback: revert the code change.

## Open Questions

None.
