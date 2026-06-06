## 1. Database schema & migration

- [x] 1.1 Create migration `supabase/migrations/<ts>_friends_groups.sql` (additive only; do not touch existing tables/functions)
- [x] 1.2 Create table `groups` (`id uuid pk`, `name text` with length check, `owner_id uuid` → `profiles(id) on delete cascade`, `join_code text not null`, `created_at`, `updated_at`)
- [x] 1.3 Add unique index on `groups(join_code)` and an `updated_at` trigger reusing `set_updated_at()`
- [x] 1.4 Create table `group_members` (`group_id uuid` → `groups(id) on delete cascade`, `user_id uuid` → `profiles(id) on delete cascade`, `role text check in ('owner','member')`, `joined_at`, `primary key (group_id, user_id)`) + index on `group_members(user_id)`

## 2. Membership & ranking functions

- [x] 2.1 Implement `generate_join_code()` returning a `WC-XXXXX` slug from the unambiguous alphabet (exclude `0 O 1 I L`)
- [x] 2.2 Implement `create_group(p_name text)` `security definer` RPC: insert group with a collision-retried unique `join_code`, insert owner `group_members` row (`role='owner'`), return group id
- [x] 2.3 Implement `join_group(p_code text)` `security definer` RPC: resolve group by `join_code`, insert `(group_id, auth.uid(), 'member') on conflict do nothing`, return group id; raise/flag when code is invalid
- [x] 2.4 Implement `leaderboard_for_group(p_group_id uuid)` `stable security definer` function: same aggregation/columns/tie-breakers as `v_leaderboard_overall`, joined to `group_members` filtered by `p_group_id`, ranked within the group; return empty set when `auth.uid()` is not a member

## 3. Row-Level Security & grants

- [x] 3.1 Enable RLS on `groups` and `group_members`
- [x] 3.2 `groups` policies: select for members of the group; update/delete for owner only; no direct insert (creation via `create_group` RPC)
- [x] 3.3 `group_members` policies: select for co-members; no user-facing insert (joining via `join_group` RPC); delete by self (leave) or by group owner (remove member); block owner self-leave while other members remain
- [x] 3.4 Grant `execute` on `create_group`, `join_group`, `leaderboard_for_group` to `authenticated`; verify no broad write grants on the new tables

## 4. Types & data layer

- [x] 4.1 Regenerate `lib/database.types.ts` from the updated schema
- [x] 4.2 Add aliases in `lib/db.ts`: `GroupRow`, `GroupMemberRow`, and `GroupLeaderboardRow` (from `Functions.leaderboard_for_group.Returns`)
- [x] 4.3 Create `lib/groups.ts` server helpers: list caller's groups, fetch one group + member list, fetch group board via `leaderboard_for_group`, fetch join-preview (name only) by code
- [x] 4.4 Add server actions for create / join / rename / leave / remove-member / delete-group calling the RPCs and table mutations, with `revalidatePath` on `/groups` and `/groups/[id]`

## 5. Routes & UI

- [x] 5.1 `/groups` page: list caller's groups, "Create group" form, and "Join by code" input
- [x] 5.2 `/groups/[id]` page: render the mini board reusing the existing leaderboard table component; show group name, member-scoped ranking, the viewer's personal rank context, and empty states ("No completed matches yet" / "Not yet ranked")
- [x] 5.3 `/groups/[id]` owner controls: rename, remove member, delete group; member control: leave; surface the shareable `join_code` and invite link
- [x] 5.4 `/groups/join/[code]` page: show group name + confirm-join action (no board before joining); on confirm call `join_group` and redirect to `/groups/[id]`
- [x] 5.5 Add a navigation entry to the groups surface in the authenticated `(app)` layout

## 6. Internationalization

- [x] 6.1 Add `groups.*` message keys to `messages/en.json` (labels, empty states, owner/member actions, join-by-code, invite copy)
- [x] 6.2 Mirror the keys in `messages/es.json` and `messages/fr.json`

## 7. Tests & verification

- [x] 7.1 Unit-test the server-action layer (`tests/groups-actions.test.ts`): create/join name+code validation, correct RPC wiring (`create_group`/`join_group`/`leave_group`/`remove_group_member`), error→i18n-key mapping, and redirects
- [x] 7.2 Verify i18n key parity for the new `groups.*` + `nav.groups` keys across en/es/fr (enforced by `tests/i18n.test.ts`)
- [x] 7.3 Verify the SQL/RLS scenarios — ranking parity & member-scoping, non-member empty board, direct-insert blocked, `join_group` idempotency, owner self-leave block, cascade delete — by reading the migration. **DB-level e2e is deferred** (this repo's vitest is pure-TS + mocks; no live Postgres), consistent with the existing SQL-test deferral in `add-world-cup-2026-pool`
- [x] 7.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test` (92 pass), and `pnpm build` (all routes compile) — all green
- [ ] 7.5 (deferred) DB-level e2e against a live Supabase: ranking parity, RLS non-member denial, join gating, lifecycle/cascade — run once the migration is applied
