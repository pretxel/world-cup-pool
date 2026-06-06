## Context

The pool runs a single global pipeline: each user submits one `predictions` row per match; when an admin marks a match `final`, `compute_match_scores()` writes one `scores` row per `(user, match)`; `v_leaderboard_overall` ranks every user by summed points with tiebreakers (exact hits → winner_gd hits → earliest submit). Scores are **global and group-agnostic** — there is exactly one score per user per match.

This change adds private friend groups, each rendering a "mini board": the same ranking restricted to the group's members. Because scores already exist per user, a group board needs no new predictions and no new scoring — only a membership model and a ranking query parameterized by group. The existing global `/leaderboard` and all of predictions/scoring/cron stay untouched.

Relevant existing pieces this design reuses or mirrors:
- `v_leaderboard_overall` (init migration) — the ranking + tiebreaker logic to replicate, scoped to members.
- `leaderboard_for_day(d, tz)` — the established pattern of a parameterized `stable` SQL function returning leaderboard rows.
- `handle_new_user()` / `is_admin()` — `security definer` function conventions with `set search_path = public`.
- RLS conventions (per-table policies, `to authenticated`, owner-scoped `using`/`with check`).
- The leaderboard table UI component on `/leaderboard` — reused to render group boards.

## Goals / Non-Goals

**Goals:**
- A signed-in user can create a group, share a code/link, and have friends join.
- Each group renders a member-scoped ranking identical in rules to the global board (same points, same tiebreakers), with rank recomputed within the group.
- Zero change to predictions, scoring, cron, and the public global leaderboard.
- Safe membership: a user can only add **themselves**, and only with a valid join code; group/board contents are visible only to members.

**Non-Goals (v1):**
- Email invitations and pending-invite state.
- Public/discoverable groups and search.
- Per-group predictions, per-group scoring, or per-group score windows (joining mid-tournament counts a member's full history — explicitly chosen).
- Viewing co-members' picks for *upcoming* matches (current global policy already reveals picks after `final`; no group-scoped relaxation in v1).
- Group size caps or per-user group-count caps.
- Ownership transfer (an owner exits only by deleting the group in v1).

## Decisions

### Decision: Group boards are read-only lenses over global `scores`, not new pools
Rank within a group is computed by the same aggregation as `v_leaderboard_overall`, filtered with `join group_members gm on gm.user_id = s.user_id where gm.group_id = p_group_id`. One prediction → one score → counted in every group the user belongs to.
- **Why:** Scores are already per `(user, match)`. Re-scoring per group would duplicate data, risk divergence from the global board, and force the scoring trigger to know about groups. A lens keeps a single source of truth.
- **Alternative rejected:** Per-group `predictions`/`scores`. Massive duplication, no behavioral benefit, couples scoring to group membership.

### Decision: Member-scoped ranking via `leaderboard_for_group(p_group_id uuid)` SQL function
Mirror the existing `leaderboard_for_day` pattern: a `stable`, `security definer` SQL function returning the same columns as `v_leaderboard_overall` plus the within-group `rank`. The function guards on caller membership: it returns rows only when `auth.uid()` is a member of `p_group_id`, otherwise an empty set.
- **Why:** Consistent with the codebase's existing parameterized-leaderboard function. `security definer` lets it read `scores`/`profiles`/`group_members` under one controlled query while the membership guard enforces visibility. Returning empty (rather than raising) lets the route render a clean not-found/forbidden without exception handling.
- **Alternative rejected:** A parameterized view — Postgres views can't take arguments; would require a session GUC or per-call filtering in app code, both clumsier than a function.

### Decision: Joining goes through a `join_group(p_code text)` `security definer` RPC, not direct `INSERT` RLS
`group_members` has **no** user-facing INSERT policy. Joining is only possible by calling `join_group(code)`, which resolves the group by `join_code`, inserts `(group_id, auth.uid(), 'member')` `on conflict do nothing`, and returns the group id.
- **Why:** If self-insert were a plain RLS policy (`with check (user_id = auth.uid())`), any authenticated user could insert themselves into **any** `group_id` they could guess — the code would be decorative. Funneling through an RPC means knowledge of the secret `join_code` is the actual gate, and the raw table stays locked.
- **Alternative rejected:** INSERT policy gated on a code passed as a column — RLS `with check` can't easily verify a secret the caller supplies without leaking it; an RPC is the clean boundary.

### Decision: `join_code` is a short, unambiguous, collision-checked slug
Format `WC-XXXXX` where `X` ∈ a 31-char alphabet excluding visually ambiguous characters (`0/O`, `1/I/L`). Generated server-side; on unique-constraint violation, regenerate and retry. Unique index on `join_code`.
- **Why:** ~31^5 ≈ 28M codes is ample for a friends-pool scale while staying short enough to type or read aloud. Excluding ambiguous glyphs avoids "is that a zero or an O" support pain.
- **Note:** Codes are guessable in principle; see Risks for the enumeration mitigation.

### Decision: Owner is also a `group_members` row (`role='owner'`)
On create, insert the group then a membership row for the owner with `role='owner'`. Membership is the single source of "who's on the board."
- **Why:** The board query joins `group_members` only; making the owner a member means no special-casing the creator in ranking, leave, or member-list logic.

### Decision: Routes live under the authenticated `(app)` group
`/groups` (list + create + join-by-code), `/groups/[id]` (mini board), `/groups/join/[code]` (preview + confirm). All require auth, matching `(app)/my-picks`.
- **Why:** Groups are inherently private and per-user; they belong with the authenticated surface, not the public `(public)` group that hosts `/leaderboard`.

### Decision: Cascade deletes mirror the existing schema
`group_members.group_id` → `groups(id) on delete cascade`; `group_members.user_id` and `groups.owner_id` → `profiles(id) on delete cascade`. Deleting a group removes its memberships; deleting a profile removes its groups and memberships.
- **Why:** Consistent with `predictions`/`scores` cascade behavior in the init migration; no orphan rows.

## Risks / Trade-offs

- **Self-insert privilege escalation** → No INSERT policy on `group_members`; joining only via the `join_group` `security definer` RPC, which always uses `auth.uid()` as the inserted `user_id`. The caller cannot choose whom to add or which group beyond what the secret code resolves to.
- **Join-code enumeration / spam joins** → ~28M-code space plus the unambiguous alphabet makes blind guessing impractical at friends scale; document a follow-up to rate-limit `join_group` calls per user (e.g., via the existing platform) if abuse appears. Codes are not secrets-of-record (no sensitive data behind them — only a ranking of public display names), bounding the blast radius.
- **Groups are a ranking boundary, not an identity boundary** → `profiles_select_authenticated` already lets any signed-in user read every `display_name`. Group membership scopes *who appears on a board*, not whether names are knowable. Acceptable for a friends pool; called out so nobody assumes group privacy hides identities.
- **Whole-tournament scoring feels like "leapfrogging" for late joiners** → Deliberate, user-chosen trade-off for simplicity (one ranking query, no per-member windows). If it ever grates, a `joined_at`-based `kickoff_at >=` filter is an additive change to the function. Documented so the behavior is intentional, not a bug.
- **Empty group board (no scored matches yet, or solo member with no scores)** → The function returns zero rows; the route renders an empty state ("No completed matches yet") rather than erroring. Personal-rank context shows "Not yet ranked" mirroring the global board.
- **Owner exit orphaning a group** → v1 disallows an owner *leaving* while other members remain; the owner exits by *deleting* the group (cascades memberships). Ownership transfer is deferred (Open Question) to avoid building member-promotion UI now.
- **Concurrent / repeat joins** → `group_members` PK `(group_id, user_id)` + `join_group` `on conflict do nothing` make joining idempotent; clicking an invite twice is a no-op that still lands the user on the board.

## Migration Plan

1. New migration `supabase/migrations/<ts>_friends_groups.sql`: create `groups`, `group_members`, indexes, `leaderboard_for_group()`, `join_group()`, RLS policies, and grants — additive only, no changes to existing tables/functions.
2. Regenerate `lib/database.types.ts` from the updated schema.
3. Build routes + UI under `(app)/groups`, reusing the leaderboard table component.
4. Add `en`/`es`/`fr` message keys for the groups surface.
5. **Rollback:** drop the two tables (cascades memberships) and the two functions; no other schema touched, so reverting is isolated and safe.

## Open Questions

- **Ownership transfer / owner-leave:** v1 = owner deletes group to exit. Do we want member→owner promotion before launch, or is delete-to-exit acceptable for v1? (Leaning: defer.)
- **Group name uniqueness:** global, per-owner, or none? (Leaning: none — names are labels, identity is the id/code.)
- **Join-code rotation:** should owners be able to regenerate a leaked code? (Leaning: nice-to-have, defer; trivial additive RPC later.)
- **Rate limiting `join_group`:** needed at launch or only if abuse appears? (Leaning: ship without, monitor.)
