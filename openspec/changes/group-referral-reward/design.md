## Context

Membership in a friend group is created in exactly one place: the `join_group(p_code)` security-definer RPC (`supabase/migrations/20260607000000_friends_groups.sql`, re-scoped to a competition in `20260614000300_groups_competition_scope.sql`). `group_members` has no insert policy, so the RPC is the sole join path. It is called from `joinGroupAction` (`app/[locale]/(app)/groups/actions.ts`), which is used by two UIs:

- `JoinGroupForm` (`group-forms.tsx`) — manual code entry on `/groups`.
- `JoinConfirmForm` (`join/[code]/join-confirm.tsx`) — the one-click confirm on the invite-link landing page `join/[code]/page.tsx`, which already resolves the group name via `getGroupPreview` (`lib/groups.ts`).

The join is idempotent: `insert into group_members ... on conflict (group_id, user_id) do nothing`. The `group_members` PK is `(group_id, user_id)`.

The competitive leaderboards are derived **only** from `public.scores`:
- `v_leaderboard_overall` (global) and `leaderboard_for_group(p_group_id)` (per-group mini board) both aggregate `sum(s.points)` from `public.scores` joined to predictions. `scores` rows are written exclusively by `compute_match_scores` (one prediction → one score row).
- The friends-groups migration header states it is "purely additive and does not touch predictions, scores, compute_match_scores, or the global leaderboard."

This is the central constraint: a referral bonus must be stored and reported **outside** `scores`, or it would inflate the prediction ranking that the whole product is built around.

Repo facts already established (not re-litigated here): prod email works (`EMAIL_FROM=no-reply@edselserrano.com`, domain verified), `profiles` has `email_prefs` (jsonb) + `welcome_email_sent_at`, and the analytics (`trackEvent` in `lib/analytics.ts`), nudge, and related QW changes have shipped. Email invitations are a separate change (`group-email-invite`, análisis.md M5) and out of scope here.

## Goals / Non-Goals

**Goals:**
- Capture who invited a user, persisted on the membership row (`group_members.invited_by_user_id`), set exactly once at join time and only when a real, distinct, already-member inviter is supplied.
- Award a fixed referral bonus to both inviter and invitee on the first invited join, recorded once per (group, invitee) in a dedicated `group_referrals` table — never in `scores`.
- Keep the competitive leaderboards (`v_leaderboard_overall`, `leaderboard_for_group`) byte-for-byte unchanged: the bonus is a separate, tracked value, not prediction points.
- Thread the inviter through the existing invite-link flow only (`?ref=` → `join_group p_invited_by`), reusing the current RPC/server-action/form plumbing with no new join path.
- Make capture and award idempotent and self-credit-proof so re-joins, self-links, and replays cannot double-award or mis-credit.
- Make the loop measurable: emit a `group_referral` analytics event on a settled invited join.

**Non-Goals:**
- Email/SMS invitations (separate change `group-email-invite`).
- Any change to prediction scoring, `compute_match_scores`, `scores`, or the leaderboard views/RPCs.
- Folding referral points into the competitive ranking, or a redeemable rewards economy.
- Multi-level / chained referral attribution, or inviter rewards for repeat joins by the same invitee.
- Anti-abuse beyond the self-credit, already-member, and once-per-pair guards (no rate limiting, no device fingerprinting).

## Decisions

- **Separate ledger, never `scores` (the core decision).** Referral bonuses go into a new `public.group_referrals` table, not into `public.scores`. Rationale: `scores` is the sole input to `v_leaderboard_overall` and `leaderboard_for_group`; writing a non-prediction row there would corrupt the competitive ranking and break the "one prediction → one score" invariant the friends-groups migration explicitly preserves. The "note vs. separate bonus" choice is resolved as **separate, tracked bonus** (a `points int` column on `group_referrals`) so the value is real and queryable, but isolated. Surfacing it in the UI as "referral points" distinct from prediction points is left to the consumer; this change does not merge the two.
- **`group_referrals` shape.** `group_id uuid`, `inviter_id uuid`, `invitee_id uuid` (all FK to the respective tables, `on delete cascade`/`set null` as appropriate), `points int not null` (the fixed bonus, e.g. a constant defined in the RPC), `created_at timestamptz default now()`, with a `unique (group_id, invitee_id)` constraint so a given user can only ever trigger one referral reward per group. The bonus is symmetric (same `points` credited to both parties) and recorded as a single row that names both; a reader sums inviter-side and invitee-side credit per user as needed.
- **Capture column.** `group_members.invited_by_user_id uuid references public.profiles(id) on delete set null`, nullable (manual joins and pre-existing members have no inviter). Set only on the membership row the RPC actually creates.
- **Single source of truth: extend `join_group`.** All capture + award logic lives inside the existing `join_group` definer RPC (re-created with a new optional `p_invited_by uuid default null` param), so there is exactly one transactional path and RLS stays closed (`group_members`/`group_referrals` have no client insert policy). The RPC: resolves the group by code; inserts the membership with `invited_by_user_id` via `on conflict do nothing`; then, only if the insert created a new row (detected via `xmax`/`RETURNING` / a row-count check), validates the inviter and writes the `group_referrals` row + bonus.
- **Guards (all enforced in the RPC):**
  - **Self-credit:** ignore `p_invited_by` when it equals `auth.uid()`.
  - **Inviter must be a real member:** ignore `p_invited_by` unless that user is already a member of the same group (prevents crediting strangers / fabricated ids).
  - **First join only:** the `group_members` `on conflict do nothing` means a re-join does not create a row; the referral block runs only when a new membership row was created, so re-joining never re-awards and never overwrites an existing `invited_by_user_id`.
  - **Once per (group, invitee):** the `unique (group_id, invitee_id)` on `group_referrals` plus `on conflict do nothing` makes the award write idempotent even under races.
- **Threading the inviter.** Invite links carry `?ref=<inviterId>`. `join/[code]/page.tsx` reads the param, passes it to `JoinConfirmForm`, which submits it as a hidden field; `joinGroupAction` validates it as a UUID (drop if malformed) and forwards it as `p_invited_by`. The manual `JoinGroupForm` submits no inviter. The invite/copy-link affordance appends `?ref=<currentUserId>` to the shared URL.
- **Analytics.** Reuse the existing settled-without-error pattern (the `group_joined` `trackEvent` in `group-forms.tsx`/`join-confirm.tsx`): when an invited join settles successfully, additionally emit `group_referral`. No raw join code or PII in the event payload (consistent with the existing `group_joined` emission).
- **Bonus magnitude.** A single fixed constant (defined once in the RPC, e.g. a small integer). Kept out of `scores`, so its exact value has no effect on competitive ranking and can be tuned in a later migration without leaderboard risk.

## Risks / Trade-offs

- **DB migration required.** This change needs a Supabase migration under `supabase/migrations/` (timestamped filename): the new `group_members.invited_by_user_id` column, the `group_referrals` table + RLS, and a re-created `join_group(p_code, p_invited_by)` RPC. Re-creating the RPC must preserve existing behavior for the no-inviter call path (the manual form calls it without the new arg, relying on the `default null`). Adding a defaulted parameter to a Postgres function creates a NEW overload rather than replacing the old one (see the precedent in `20260614000300_groups_competition_scope.sql`, which had to `drop function ... generate_join_code()` first); the migration MUST `drop function if exists public.join_group(text)` before re-creating, then re-grant execute to `authenticated`.
- **No cron, no Realtime.** This feature has no scheduled-job or Supabase Realtime requirement; it is fully synchronous inside the join RPC and the existing request flow.
- **Spoofable `?ref=` param.** A user could hand-edit the ref to credit an arbitrary id. Mitigated by the "inviter must already be a member of that group" guard (a stranger's id is dropped) and the self-credit guard. Crediting a different *member* of the same group is possible but low-value and not worth heavier anti-fraud for a friend pool.
- **Bonus has no surfaced home yet.** Recording referral points only matters once they are shown. This change persists and exposes them (table + `GroupReferralRow` type + analytics event) but intentionally does not render a UI badge or fold them into rankings; that is a deliberate scope cut and a known follow-up.
- **Idempotency vs. attribution race.** If a user somehow joins via two invite links nearly simultaneously, the `unique (group_id, invitee_id)` guarantees a single award; which inviter "wins" is whichever membership-insert commits first. Acceptable — the outcome is always exactly one award to one valid inviter.
- **Regenerating `lib/database.types.ts`** after the migration must not clobber the hand-written aliases in `lib/db.ts` (the file header notes regeneration won't overwrite `db.ts`); the new `GroupReferralRow` alias is added to `db.ts`.
