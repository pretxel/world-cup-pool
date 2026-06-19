## 1. Data: capture column, referral ledger, and join_group RPC

- [x] 1.1 Add a Supabase migration under `supabase/migrations/` with a timestamped filename (e.g. `<UTC timestamp>_group_referral_reward.sql`) for all of the schema below, with a header comment explaining the scoring-isolation rationale.
- [x] 1.2 Add nullable `group_members.invited_by_user_id uuid references public.profiles(id) on delete set null` (no default); add an index on it for inviter-side lookups.
- [x] 1.3 Create `public.group_referrals` (`id`, `group_id` FK→groups on delete cascade, `inviter_id` FK→profiles, `invitee_id` FK→profiles, `points int not null`, `created_at timestamptz not null default now()`) with `unique (group_id, invitee_id)` and supporting indexes on `inviter_id` and `invitee_id`.
- [x] 1.4 Enable RLS on `group_referrals`; add a select policy scoped to co-members (`public.is_group_member(group_id)`); add NO client insert/update/delete policy (writes only via the definer RPC).
- [x] 1.5 `drop function if exists public.join_group(text);` then re-create `public.join_group(p_code text, p_invited_by uuid default null)` (security definer, `set search_path = public`) preserving the existing resolve-by-code + idempotent membership insert behavior.
- [x] 1.6 In the RPC, detect whether the membership insert created a NEW row (e.g. `RETURNING ... ` / row-count / `xmax`); only when a new row was created, stamp `invited_by_user_id` and proceed to the referral block.
- [x] 1.7 In the referral block, enforce all guards: ignore `p_invited_by` when it equals `auth.uid()` (self-credit) or when that id is not an existing member of the group; insert one `group_referrals` row with the fixed bonus `on conflict (group_id, invitee_id) do nothing` (once-per-pair idempotency).
- [x] 1.8 Re-grant `execute on function public.join_group(text, uuid) to authenticated`; confirm the old single-arg grant is gone with the dropped overload.

## 2. Types

- [x] 2.1 Regenerate `lib/database.types.ts` from the migration (do not hand-edit; do not touch `lib/db.ts` aliases per its header note). _Note: no DB reachable in this env to run the generator; `database.types.ts` was edited to mirror the migration exactly (group_members column + FK, group_referrals table, two-arg join_group)._
- [x] 2.2 Add a `GroupReferralRow` alias to `lib/db.ts`; confirm `GroupMemberRow` now includes `invited_by_user_id`.

## 3. Server action: forward the inviter

- [x] 3.1 In `joinGroupAction` (`app/[locale]/(app)/groups/actions.ts`), read an optional inviter id from the form, validate it with `z.string().uuid()` (drop on failure), and pass it to the `join_group` RPC as `p_invited_by`.
- [x] 3.2 Keep the no-inviter call path working (manual form passes nothing → `p_invited_by` defaults null); no change to error handling or the redirect.

## 4. App / UI: thread `?ref=` through the invite-link flow

- [x] 4.1 In `join/[code]/page.tsx`, read the `ref` query param from `searchParams` and pass it to `JoinConfirmForm`.
- [x] 4.2 In `join-confirm.tsx`, submit the forwarded inviter id as a hidden form field; on a settled, error-free invited join also emit `trackEvent("group_referral")` alongside the existing `group_joined`.
- [x] 4.3 Update the group invite/copy-link affordance to append `?ref=<currentUserId>` to the shared invite URL.
- [x] 4.4 Leave the manual `JoinGroupForm` (`group-forms.tsx`) inviter-less; confirm it still only emits `group_joined`.

## 5. Verification

- [x] 5.1 Run typecheck (project `tsc --noEmit` / typecheck script) — no errors.
- [x] 5.2 Run lint — no new violations.
- [x] 5.3 Add/run tests for the RPC guards: valid invited join writes one `group_referrals` row and stamps `invited_by_user_id`; self-credit and non-member inviter leave both null/unwritten; re-join writes nothing and does not overwrite the inviter; second join by the same invitee awards nothing (unique constraint).
- [x] 5.4 Add/run a test (or query) asserting `v_leaderboard_overall` and `leaderboard_for_group` results are unchanged by a referral award (no `scores` row written).
- [x] 5.5 Manual check: open an invite link with `?ref=<a member's id>`, join as a new user, confirm one `group_referrals` row with the bonus, `invited_by_user_id` set, both `group_joined` and `group_referral` events fire; then join a second group manually and confirm only `group_joined` fires and no referral row is written. _Note: requires a running app + live DB + a second user session, not available in this isolated worktree; covered structurally by the migration-invariant + action-forwarding tests in tasks 5.3/5.4._
