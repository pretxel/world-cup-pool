## Context

The friend-group mini board is produced by the `leaderboard_for_group(p_group_id uuid)` SQL function, a `security definer` RPC last re-created in `supabase/migrations/20260614000300_groups_competition_scope.sql`. Its aggregate CTE sums `public.scores` per member, joined to `group_members` (membership), `groups` + `matches` (competition scope), and `predictions` (for the `first_submit` tie-breaker), gated by `public.is_group_member(p_group_id)` so non-members get an empty board. It returns one row per member: `total_points, exact_hits, winner_gd_hits, winner_hits, first_submit, rank`, ranked by `rank() over (order by total_points desc, exact_hits desc, winner_gd_hits desc, first_submit asc)`. The function's own comment states "Whole-tournament scoring (no join-date filter)".

The two facts that make join-date scoring cheap already hold:
- `group_members.joined_at timestamptz not null default now()` exists (`20260607000000_friends_groups.sql`) and is per-(group, member). The referral migration (`20260619170000_group_referral_reward.sql`) added `invited_by_user_id` but did not touch `joined_at` or the leaderboard function.
- `matches.kickoff_at timestamptz not null` exists with `matches_kickoff_at_idx` (`20260513000000_init.sql`), and `leaderboard_for_day` already proves the pattern of filtering the same aggregate by a `matches.kickoff_at` window.

The global board (`v_leaderboard_overall`, `20260614000200_leaderboard_competition_scope.sql`) is the canonical all-time ranking and is the source for result-email rank lines, rank snapshots, comeback emails, and the public `/leaderboard`. It must not change. A precedent is already documented in the codebase: the referral migration calls scoring isolation "the load-bearing constraint" and keeps bonuses out of `scores` precisely so the leaderboards stay byte-for-byte stable. This change respects the same boundary — it only adds a row-filtering predicate inside the group RPC.

The consumer (`lib/groups.ts` `getGroupBoard` → `supabase.rpc("leaderboard_for_group", { p_group_id })` → `LeaderboardTable`) is shape-driven, so as long as the `RETURNS TABLE` signature is preserved no TypeScript changes are required beyond regenerating Supabase types.

## Goals / Non-Goals

**Goals:**
- Score the GROUP mini board so each member is ranked only over matches that kicked off on or after that member's `group_members.joined_at`.
- Use the **per-member** join date (founders scored from group creation, late joiners from their own join), not a single group-wide cutoff.
- Preserve the RPC's exact `RETURNS TABLE` shape, `security definer` posture, `is_group_member()` membership guard, competition scope, and tie-breaker order, so no caller signature changes.
- Make the new semantics legible in the group UI (explainer + accurate empty / not-yet-ranked copy), localized in en, es, fr, de.
- Keep the change a single reversible migration plus a copy/UI tweak.

**Non-Goals:**
- Changing the GLOBAL leaderboard (`v_leaderboard_overall`), `leaderboard_for_day`, the segmented leaderboard functions, or any user's all-time point total. Out of scope, explicitly unchanged.
- Touching `scores`, `predictions`, or `compute_match_scores`. Group scoring stays a pure read-time projection over existing scores.
- A configurable per-group cutoff, an "include pre-join history" toggle, retroactive backfill of a different join date, or freezing `joined_at` against re-joins. Out of scope for this bet.
- Any new infra: no cron, no Realtime channel, no push / service worker / web push / VAPID, no new tables or columns.

## Decisions

- **Per-member predicate inside the existing aggregate.** Add `join public.matches m on m.id = s.match_id and m.competition_id = g.competition_id` (the competition join already exists) and the predicate `m.kickoff_at >= gm.joined_at` to the CTE. Because the join already binds `gm` to the specific `(group, member)` row, the predicate is naturally per-member. No new join, no subquery.
- **Boundary is `>=` (inclusive of join instant).** A match whose kickoff is exactly at or after the member's `joined_at` counts; a match already kicked off when they joined does not. This matches the intuitive "you're scored for everything from when you joined onward" and aligns with how predictions lock at kickoff — a member who joined before kickoff could still have a valid pick, so they should be scored for it. Equivalently, only matches the member could still legitimately predict at join time are scored.
- **Founders are unaffected in practice.** A group's owner has `joined_at` = group creation time. For an existing single-founder group whose creation predates every scored match, every match satisfies `kickoff_at >= joined_at`, so their board is identical to today — the change is parity for early members and only re-levels genuine late joiners. (A founder who creates a group mid-tournament is, correctly, also scored only from creation onward.)
- **Re-join resets the slice.** `leave_group` deletes the membership row; `join_group` inserts a fresh one with `joined_at = now()`. So leaving and re-joining moves a member's cutoff forward. This is accepted: it is consistent ("you're scored from when you're a member"), it cannot be used to gain points (it can only shrink the scored window), and freezing the original join date would require new schema we are deliberately not adding. Noted as a known trade-off.
- **Tie-breakers and `first_submit` semantics unchanged.** `first_submit` stays `min(predictions.submitted_at)` across the member's counted matches; with the join filter it naturally reflects only post-join predictions, which is the desired behavior for a join-scoped board. Rank order (points → exacts → winner+GD → earliest first submit) is preserved.
- **Migration re-creates the function with `create or replace`** and re-grants `execute ... to authenticated`, mirroring every prior redefinition of this RPC. The function comment is updated from "no join-date filter" to describe the per-member filter so the next reader is not misled. Rollback = restore the body from `20260614000300_groups_competition_scope.sql`.
- **UI explainer over silent change.** Because a member's group points can now legitimately differ from (and be lower than) their global total, the group page states that the board scores each member from when they joined. The existing "not yet ranked" copy is reused/extended for the new case where a freshly joined member has no post-join scored matches yet (their row is simply absent until a counted match finals).

## Risks / Trade-offs

- **Competitive scoring impact (the core risk).** Group rankings will change for any group with post-start joiners. This is the intended outcome, but it is a visible shift in a competitive surface. Mitigations: the GLOBAL board is untouched (the canonical ranking still exists and is stable), the row shape and tie-breakers are preserved, and the UI explainer sets expectations. Founders of pre-start groups see no change (parity), bounding surprise to groups that actually have late joiners.
- **DB migration to a `security definer` competitive RPC.** A logic error could leak cross-group/cross-member rows or break the membership guard. Mitigation: keep `is_group_member()` and the competition scope exactly as-is; the only delta is one `kickoff_at >= joined_at` predicate; verify with a query that members see only their own group and that join-date filtering is correct for a synthetic late-joiner.
- **Performance.** The added predicate rides the existing `matches.kickoff_at` join (indexed) and the per-member `joined_at` already loaded by the membership join. Group boards are small (members of one group); no measurable cost expected and no new index required.
- **Re-join resets cutoff** (decision above): a member who leaves and re-joins loses credit for matches between their original and new join. Acceptable because it cannot inflate a score and avoids new schema; if it ever matters, a future change could persist a `first_joined_at`. Out of scope here.
- **Optics for late joiners with few matches.** Early in a late joiner's tenure their board may be sparse (few or zero counted matches → absent or low row). This is correct and is exactly the fairness goal (no inherited deficit); the not-yet-ranked copy prevents it from reading as a bug.
- **No new infra**, so no service-worker / VAPID / push / cron / Realtime surface area or operational risk is introduced.
