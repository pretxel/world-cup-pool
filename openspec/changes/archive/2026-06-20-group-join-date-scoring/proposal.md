## Why

A friend group's mini board is scored over the **whole tournament**. `leaderboard_for_group()` (last defined in `20260614000300_groups_competition_scope.sql`) aggregates every row of `public.scores` for each member, with no reference to when that member joined — its own header comment even says "Whole-tournament scoring (no join-date filter)." The result is the friction called out in `análisis.md` section 2 ("Grupos sin pulso": *"el scoring es de todo el torneo: los que entran tarde arrastran desventaja sin filtrado por fecha de ingreso"*) and queued as the engagement **apuesta grande** in section 4 and the roadmap ("Filtrado de scoring por fecha de ingreso al grupo para nivelar a los late joiners").

Concretely: a friend invited at the Round of 16 — exactly the moment groups grow virally now that referral rewards and email invites have shipped (M4/M5) — sees a board where the founders already banked dozens of group-stage matches. The newcomer is buried at the bottom on day one with a gap that is mathematically unreachable, so they never come back. The most viral surface punishes the people virality just delivered.

The fix is to score the **group** board only from matches kicking off **after** each member's `joined_at`, so every member competes on the slice of the tournament they were actually present for. `group_members.joined_at` already exists (`20260607000000_friends_groups.sql`) and `matches.kickoff_at` is already the timestamp the per-day board filters on (`leaderboard_for_day`), so this is a self-contained change to a single RPC.

This is **competitive scoring**: the GLOBAL leaderboard (`v_leaderboard_overall`) is the canonical all-time ranking and is **explicitly unchanged**. Only `leaderboard_for_group()` gains the per-member join-date filter, and the group UI must explain the new semantics so members understand why their group points differ from their global total.

## What Changes

- Modify the `leaderboard_for_group(p_group_id uuid)` RPC so each member's aggregate counts **only** scores for matches whose `kickoff_at >= that member's group_members.joined_at`. The per-member join date is joined in, not a single group-wide cutoff, so founders and late joiners are each scored from their own entry point. Row shape, the `is_group_member()` guard, the competition scope, the `security definer` posture, and the tie-breaker order (points, exacts, winner+GD, earliest first submit) are all unchanged, so `getGroupBoard` and `LeaderboardTable` need no signature change.
- Keep the boundary deterministic and inclusive of join time: a match counts for a member when `m.kickoff_at >= gm.joined_at` (a member present at kickoff is scored for that match; matches already kicked off when they joined are excluded). Re-joining (leave then re-join) resets `joined_at`, so the join-date slice is whatever the current membership row says — this is acceptable and noted in design.
- Surface the new semantics in the group page (`groups/[id]/page.tsx`): a short explainer that the group board scores each member from when they joined, and updated empty / not-yet-ranked copy for a member who has joined but has no post-join scored matches yet. Localized in en, es, fr, de.
- Leave `v_leaderboard_overall`, `leaderboard_for_day`, the segmented leaderboard functions, `scores`, `predictions`, and `compute_match_scores` **untouched**. The global board and a user's global point total are unaffected; only the group-scoped ranking changes.

## Capabilities

### New Capabilities
- `group-join-date-scoring`: a friend group's mini board ranks each member using only the scores for matches that kicked off on or after that member joined the group, while the global leaderboard remains whole-tournament; the group board keeps the same row shape, member-only visibility, competition scope, and tie-breakers as today.

### Modified Capabilities

## Impact

- Data: new migration under `supabase/migrations/` that re-creates `public.leaderboard_for_group(uuid)` with the per-member `kickoff_at >= joined_at` filter and re-grants execute to `authenticated`. No table or column changes (`group_members.joined_at` and `matches.kickoff_at` already exist). Rollback restores the function body from `20260614000300_groups_competition_scope.sql`.
- Code: `lib/groups.ts` (`getGroupBoard`) and `lib/db.ts` (`GroupBoardRow`) are unchanged — the RPC name, parameters, and `RETURNS TABLE` shape are identical; only the regenerated Supabase types are refreshed.
- UI / i18n: `app/[locale]/(app)/groups/[id]/page.tsx` gains a join-date-scoring explainer and updated empty/not-yet-ranked copy; new strings in the existing `groups` namespace across en, es, fr, de.
- Competitive scoring: this is the only behavior change. Group rankings will shift for any group containing members who joined after the tournament started; the global leaderboard and all-time totals are byte-for-byte unchanged.
- No new dependency, cron, Realtime, push, service worker, VAPID, or infra requirement. Rendering stays SSR exactly as the current group page.
