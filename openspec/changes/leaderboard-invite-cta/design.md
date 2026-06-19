## Context

The public `/leaderboard` page (`app/[locale]/(public)/leaderboard/page.tsx`) is server-rendered. It resolves the current user via `supabase.auth.getUser()`, fetches the full ranking from `v_leaderboard_overall`, and derives `myRow = rows.find(r => r.user_id === user.id)`. It already renders, conditionally:

- a "share your rank" section (`ShareButtons`) gated on `myRow`, and
- a "not yet on the board" card gated on `user && !myRow && rows.length > 0`.

Both already use the locale-aware `localePath(locale, "/matches")` helper and `Link` + `ArrowRightIcon`, so the patterns and imports for a new signed-in CTA already exist on this page.

`LeaderboardTable` (`components/leaderboard-table.tsx`) is a shared presentational component used by both the global board and the per-group mini board. It marks the current user's row with `isMe` styling but exposes no slot for per-row actions. Groups are reached at `/groups`, which holds both the create form (`CreateGroupForm`) and the join form (`JoinGroupForm`); per-group invite (`InviteShare` in `group-controls.tsx`) is copy-code/copy-link only. The mechanic for growing a group is therefore "go to `/groups` → create or join". This change is purely a navigational entry point to that surface; it does not add an invite channel or touch `lib/groups.ts`.

## Goals / Non-Goals

**Goals:**
- Show a signed-in player a clear "invite friends / create a group" CTA on `/leaderboard`, near their own context, that links to the groups create/join surface (`/groups`).
- Remove the navigation hop from "I'm looking at my rank" to "I'm inviting friends / creating a group".
- Keep the change small: reuse the page's existing `user`/`myRow`/`localePath`, add only translation keys, no new query, no SQL/view change.
- Keep `LeaderboardTable` reusable so group mini-boards are not affected.

**Non-Goals:**
- Building an email/SMS group invitation channel (that is medium bet M5; this CTA only links to the existing groups surface).
- Adding referral tracking, `invited_by_user_id`, or join rewards (medium bet M4).
- Showing the CTA to signed-out visitors or changing the empty-state / "not yet on the board" branches.
- Changing the join-code mechanism, group server actions, or `lib/groups.ts`.
- A real-time, segmented, or paginated leaderboard.

## Decisions

**Decision: Render the CTA in the page, not inside `LeaderboardTable`.**

The CTA is placed in `app/[locale]/(public)/leaderboard/page.tsx` (alongside or adjacent to the existing `myRow` "share your rank" section), gated on the signed-in user. This keeps `LeaderboardTable` purely presentational and namespace-agnostic, so the per-group mini board does not inherit a "create a group" CTA it should not show.

Rationale / alternatives considered:
- *Add an inline CTA cell/row inside `LeaderboardTable` next to the `isMe` row.* Rejected as the default: it would couple the shared table to leaderboard-specific, groups-specific copy and routing, and would leak the CTA into the group mini board unless guarded by a new prop. If a future iteration wants the CTA literally adjacent to the user's row, the table can accept an optional render slot — noted as a possible extension, not required here.

**Decision: Link to `/groups`, the existing create/join surface.**

The CTA targets `localePath(locale, "/groups")`, which already presents both `CreateGroupForm` and `JoinGroupForm`. This is the lowest-effort, correct destination for "create a group or invite friends" and matches QW6's intent ("quita un salto de navegación").

Rationale / alternatives considered:
- *Deep-link to a specific group's `InviteShare`.* Rejected: a leaderboard visitor may have zero groups, so there is no single group to invite into; `/groups` covers both "create one" and "join one" in one place.

**Decision: Gate strictly on a signed-in user.**

The CTA renders when `user` is present (the same condition that powers the existing signed-in branches). Signed-out visitors see the leaderboard unchanged; the empty-state branch (`rows.length === 0`) is unaffected. Whether the user is on the board (`myRow`) or not, the invite intent is valid, so the CTA does not require `myRow`.

**Decision: Add i18n keys in the existing `leaderboard` namespace.**

Copy (heading, body/label, link text) goes in the `leaderboard` translation namespace already used by the page, keeping all leaderboard strings together and consistent across `en`/`es`/`fr`/`de`.

## Risks / Trade-offs

- **[CTA adds visual noise near the share-rank section]** → Use the page's existing dashed-card / link styling so the CTA reads as a sibling of the "share your rank" and "not yet on the board" blocks rather than a competing banner; placement keeps it in the player's own context.
- **[Reusing `LeaderboardTable` for groups could accidentally show the CTA there]** → Mitigated by keeping the CTA in the page, not the component; the group mini board renders the same table with no CTA.
- **[`/groups` is itself behind the app group; a brand-new user may need onboarding first]** → Out of scope and unchanged: the CTA targets the same `/groups` route the nav already exposes to signed-in users; existing auth/onboarding gating is reused, not modified.
- **[No measurement of clicks]** → Analytics is a separate quick win (QW3); this change ships the entry point, and a `group_invite_cta` event can be layered on later without rework.
