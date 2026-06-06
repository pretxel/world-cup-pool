## Why

The pool today exposes a single global leaderboard ranking every user against everyone. Casual players rarely crack the top of a field that large, so the standings feel impersonal and the day-to-day competition that makes a pool fun — beating the specific people you know — has nowhere to live. Letting friends form private groups gives each player a small field where their rank actually moves, without changing how predictions or scoring work.

## What Changes

- Add **friends groups**: a signed-in user can create a named group and becomes its owner.
- Each group has a shareable **join code** and an invite link (`/groups/join/<code>`); anyone signed in who has the code can join.
- Add a **mini board** per group: the same leaderboard ranking as the global board, but scoped to only that group's members, with rank recomputed within the group.
- Group boards reuse the **existing global scores** unchanged — a user makes one prediction per match and earns one score; every group they belong to ranks them on that same score. **No per-group predictions, no per-group scoring.**
- Scoring is **whole-tournament**: a member's full history of scored matches counts toward every group board regardless of when they joined.
- Add routes: `/groups` (my groups + create + join-by-code), `/groups/[id]` (the mini board), `/groups/join/[code]` (preview + confirm join).
- Owner can rename and delete a group, and remove members; a member can leave a group.

Explicitly **out of scope for v1** (noted so reviewers know they were considered, not missed): email invitations, public/discoverable groups, viewing co-members' picks for upcoming matches, and group size / per-user group-count caps.

No breaking changes. `predictions`, `scores`, `compute_match_scores`, the match-sync cron, and the public `/leaderboard` page are untouched.

## Capabilities

### New Capabilities
- `groups`: friend group lifecycle (create, rename, delete, leave, remove member), invite-code joining with safe self-insert, group membership model, and the per-group mini-board ranking scoped to members over the global scores.

### Modified Capabilities
<!-- None. The global /leaderboard behavior is unchanged; group boards are an additive, separately-scoped read path. Predictions and scoring requirements are unaffected. -->

## Impact

- **Database (new migration)**: two new tables `groups` (with `owner_id`, unique `join_code`) and `group_members` (`group_id`, `user_id`, `role`, `joined_at`); a `leaderboard_for_group(group_id)` function reusing the `v_leaderboard_overall` ranking logic filtered to members; a `join_group(code)` `security definer` RPC for gated self-insert; RLS policies on both new tables.
- **App (new routes)**: `app/[locale]/(app)/groups/` — list/create/join, group detail board, and join-by-code confirm pages. Reuses the existing leaderboard table component for rendering.
- **Types**: regenerate `lib/database.types.ts` after the migration.
- **i18n**: new message keys for the groups surface across `en` / `es` / `fr`.
- **Untouched**: predictions flow, scoring function and triggers, cron jobs, admin surface, and the public global leaderboard.
