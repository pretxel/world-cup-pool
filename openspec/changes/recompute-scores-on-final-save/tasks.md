## 1. Server action

- [x] 1.1 In `app/(admin)/admin/matches/actions.ts#setMatchResult`, after the `admin.from("matches").update(...)` call succeeds, invoke `admin.rpc("compute_match_scores", { p_match_id: parsed.match_id })` unconditionally.
- [x] 1.2 If the RPC returns an error, `throw new Error(error.message)` to surface it to the admin.
- [x] 1.3 Add `revalidatePath("/my-picks")` to the existing revalidation block.

## 2. Tests

- [x] 2.1 Add a unit/integration test in `tests/` that mocks the Supabase admin client and asserts `rpc("compute_match_scores", { p_match_id })` is called exactly once after the UPDATE in `setMatchResult`, including on re-save with identical values.
- [x] 2.2 Run `pnpm test` — all green.

## 3. Verification

- [x] 3.1 `pnpm typecheck` — zero errors.
- [x] 3.2 `pnpm lint` — zero errors.
- [x] 3.3 `openspec validate recompute-scores-on-final-save` — valid.
- [ ] 3.4 Manual: in prod-linked admin UI, save a final match, change nothing, re-save — verify `/my-picks` and `/leaderboard` show updated `computed_at` (or new rows in `public.scores`).
