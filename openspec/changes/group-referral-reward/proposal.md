## Why

Friend groups are the product's biggest viral lever, but the social loop dies at copy-paste of the join code: there is no record of who invited whom and no reward for inviting. análisis.md flags this as medium bet **M4** ("Recompensa por referido en grupos") and as the missing piece behind the group viral-coefficient metric (section 6: "invitaciones enviadas → joins → primer pick del invitado (requiere `invited_by_user_id`)"). The join path already exists end-to-end — the `join_group(p_code)` security-definer RPC (`supabase/migrations/20260607000000_friends_groups.sql`) is the sole way membership is created, called from `joinGroupAction` (`app/[locale]/(app)/groups/actions.ts`) via both the manual code form (`group-forms.tsx`) and the invite-link confirm screen (`join/[code]/join-confirm.tsx`). What is missing is (a) capturing the inviter at join time and (b) a reward that does not corrupt the prediction-scoring leaderboard.

The scoring constraint is load-bearing: the global leaderboard (`v_leaderboard_overall`) and the per-group mini board (`leaderboard_for_group`) are computed **purely** from `public.scores` (one prediction → one score), and the original friends-groups migration explicitly promises it "does not touch predictions, scores, compute_match_scores, or the global leaderboard." So the referral reward MUST be a separate, tracked bonus — never a row in `scores` — or it would silently inflate the competitive leaderboard.

## What Changes

- Capture the inviter on join: add `group_members.invited_by_user_id uuid` (nullable, FK to `profiles`, self-credit guarded) via a Supabase migration, and extend `join_group` to accept an optional inviter id and stamp it once on the row that is actually created (idempotent — never overwritten on a re-join, never set to the joining user themselves, only valid when the inviter is already a member of that group).
- Pass the inviter through the existing invite-link flow only: the `join/[code]` page resolves an `?ref=<inviterId>` query param and threads it into `joinGroupAction` → `join_group`. The manual code-entry form has no inviter and stays unchanged (inviter null).
- Record the reward as a separate referral ledger, not in `scores`: add a `group_referrals` table (one row per successful, first-time invited join) and award a fixed referral bonus to both inviter and invitee. The bonus is surfaced as a tracked "referral points" value distinct from prediction points, so the prediction-scoring leaderboard (`v_leaderboard_overall`, `leaderboard_for_group`) is untouched.
- Make the referral creation idempotent and self-credit-proof inside the same definer RPC that creates the membership, so a row is written exactly once per (group, invitee) and only when a real, distinct inviter is present.
- Expose the inviter id to the invite UI so the existing "copy link" affordance can append `?ref=<currentUserId>`, and emit a `group_referral` analytics event (via `trackEvent`, `lib/analytics.ts`) when an invited join settles, to make the viral coefficient measurable.

Non-goals: email invitations (separate change `group-email-invite` / análisis.md M5), changing prediction scoring or the competitive leaderboards, multi-level/chained referrals, anti-fraud beyond self-credit + already-member + once-per-pair guards, and any redeemable-rewards economy.

## Capabilities

### New Capabilities
- `group-referral-reward`: capture the inviter when a user joins a group via an invite link and award a tracked referral bonus to both inviter and invitee, recorded separately from prediction scores so the competitive leaderboard is never corrupted.

### Modified Capabilities

## Impact

- **Data (Supabase migration)**: new nullable `group_members.invited_by_user_id uuid references public.profiles(id) on delete set null`; new `public.group_referrals` table (`group_id`, `inviter_id`, `invitee_id`, `points int`, `created_at`, unique on `(group_id, invitee_id)`) with RLS; updated `join_group` definer RPC to take an optional `p_invited_by uuid`, stamp `invited_by_user_id` once, and write the `group_referrals` row + bonus exactly once, all self-credit/already-member/idempotency guarded.
- **DB types**: `lib/database.types.ts` regenerated; `lib/db.ts` gains a `GroupReferralRow` alias and `GroupMemberRow` picks up the new column.
- **Server action**: `joinGroupAction` (`app/[locale]/(app)/groups/actions.ts`) accepts an optional inviter id from the form and forwards it as `p_invited_by` to `join_group`.
- **App / UI**: `join/[code]/page.tsx` reads `?ref=` and passes it to `JoinConfirmForm` (`join-confirm.tsx`), which submits it as a hidden field; the group invite/copy-link affordance appends `?ref=<currentUserId>`; `group-forms.tsx` manual join stays inviter-less.
- **Analytics**: a `group_referral` event emitted client-side on a settled invited join (mirrors the existing `group_joined` emission pattern in `group-forms.tsx` / `join-confirm.tsx`).
- **Scoring isolation**: `public.scores`, `compute_match_scores`, `v_leaderboard_overall`, and `leaderboard_for_group` are NOT modified — the referral bonus lives only in `group_referrals` and is reported as a distinct value.
- **Dependency / caveat**: referral bonuses only have visible value once they are surfaced somewhere (e.g. a future "referral points" badge); this change records and exposes them but does not fold them into the competitive ranking by design.
