## Why

Friend groups are the product's strongest viral lever, but the social loop stalls at copy-paste of a join code (`group-controls.tsx` only writes to the clipboard). The leaderboard is where a signed-in player most feels the competitive pull — they see their own highlighted row among the standings — yet there is no prompt there to bring friends in. Acting on that impulse today means navigating away to `/groups` to find the create/join forms, an extra hop that bleeds intent. Surfacing an "invite friends / create a group" CTA at the moment the player is staring at their own rank removes that hop and turns a high-intent moment into group growth (quick win QW6 in `análisis.md`).

## What Changes

- Add an "invite friends / create a group" CTA to the public `/leaderboard` page for signed-in users, placed near the player's own context (their highlighted row / the existing "share your rank" area), linking to the groups create/join surface (`/groups`).
- The CTA appears only for signed-in users; signed-out visitors and the empty-state branch are unaffected.
- The CTA reuses the existing locale-aware navigation (`localePath`) and the page's existing knowledge of the current user and their row; no new data fetch, no SQL/view change.
- No change to the join-code mechanism, group server actions, or `lib/groups.ts`; this is a navigational entry point, not a new invite channel.
- The shared `LeaderboardTable` component stays presentational — the CTA lives in the page (or, if rendered inline near the row, is passed in as content), so group mini-boards are unaffected unless explicitly wired.

## Capabilities

### New Capabilities
- `leaderboard-invite-cta`: a contextual call-to-action on the signed-in leaderboard that links directly to creating or joining a group, removing a navigation hop to grow group membership.

### Modified Capabilities

## Impact

- Code: `app/[locale]/(public)/leaderboard/page.tsx` (render the CTA for signed-in users; reuse `localePath`, the existing `user`/`myRow` values).
- Components: `components/leaderboard-table.tsx` — unchanged, or accepts optional CTA content if the CTA is rendered inline near the user's row.
- i18n: new translation keys for the CTA heading/label and link text in the `leaderboard` namespace.
- Data: no migration; `v_leaderboard_overall`, `lib/groups.ts`, and group actions are untouched.
- No API, dependency, or breaking changes.
