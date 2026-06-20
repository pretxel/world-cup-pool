## 1. Migration: per-member join-date filter in leaderboard_for_group

- [x] 1.1 Add a new migration `supabase/migrations/<timestamp>_group_join_date_scoring.sql` that `create or replace`s `public.leaderboard_for_group(p_group_id uuid)`, keeping the exact `RETURNS TABLE` shape, `language sql`, `stable`, `security definer`, and `set search_path = public`.
- [x] 1.2 In the aggregate CTE, keep the existing `group_members`, `groups`, `predictions` joins and the `is_group_member(p_group_id)` guard; ensure the `matches m` join binds `m.id = s.match_id and m.competition_id = g.competition_id`.
- [x] 1.3 Add the per-member predicate `m.kickoff_at >= gm.joined_at` so each member is aggregated only over matches that kicked off on or after their own join date (boundary inclusive of the join instant).
- [x] 1.4 Preserve the tie-breaker order (`total_points desc, exact_hits desc, winner_gd_hits desc, first_submit asc`) and the final join to `profiles`.
- [x] 1.5 Update the function header comment from "Whole-tournament scoring (no join-date filter)" to describe the per-member `kickoff_at >= joined_at` filter; document the rollback (restore the body from `20260614000300_groups_competition_scope.sql`).
- [x] 1.6 Re-grant `execute on function public.leaderboard_for_group(uuid) to authenticated`.

## 2. Types

- [x] 2.1 Regenerate Supabase types so `Database["public"]["Functions"]["leaderboard_for_group"]` is current; confirm `GroupBoardRow` in `lib/db.ts` and `getGroupBoard` in `lib/groups.ts` need no signature change (shape is identical).

## 3. Group page UI + copy

- [x] 3.1 Add a concise join-date-scoring explainer near the board section in `app/[locale]/(app)/groups/[id]/page.tsx` (members are scored from when they joined the group).
- [x] 3.2 Ensure the not-yet-ranked / empty-state copy covers the new case of a member who has joined but has no post-join scored matches yet (reuse/extend `notYetRanked` / `boardEmptyBody`).
- [x] 3.3 Add the new `groups` namespace strings in en, es, fr, and de.

## 4. Verification

- [x] 4.1 With a synthetic group containing a founder and a late joiner across already-scored matches, confirm via SQL that the late joiner's `total_points`/hit counts exclude pre-join matches and the founder's board is unchanged (parity).
- [x] 4.2 Confirm a match whose `kickoff_at` equals a member's `joined_at` is counted (inclusive boundary) and that ranks over the returned members are contiguous.
- [x] 4.3 Confirm a non-member calling `leaderboard_for_group` still receives zero rows, and a freshly joined member with no counted matches is absent from the board (renders the not-yet-ranked copy).
- [x] 4.4 Confirm `v_leaderboard_overall`, `leaderboard_for_day`, the segmented leaderboard functions, and global point totals are byte-for-byte unchanged.
- [x] 4.5 Run `openspec validate "group-join-date-scoring"` and the project lint/typecheck; verify the group page renders the board and explainer in all four locales.
