# group-referral-reward Specification

## Purpose
Capture who invited a user into a friend group and award a fixed referral bonus to both the inviter and the invitee when a user joins via an invite link. The bonus is recorded in a dedicated `group_referrals` ledger — never in `public.scores` — so the competitive prediction leaderboards (`v_leaderboard_overall`, `leaderboard_for_group`) stay byte-for-byte unchanged. The inviter is threaded through the existing invite-link flow only (`?ref=` → `join_group p_invited_by`), with self-credit, already-member, first-join-only, and once-per-pair guards enforced inside the single definer RPC, and the loop is made measurable via a `group_referral` analytics event.

## Requirements

### Requirement: Capture the inviter at join time
The system SHALL persist, on the membership row created when a user joins a group, the id of the user who invited them (`group_members.invited_by_user_id`). The inviter SHALL be supplied to the `join_group` RPC as an optional parameter (`p_invited_by`) and SHALL be stamped only on the membership row that the join actually creates. The system MUST NOT set `invited_by_user_id` to the joining user themselves, MUST NOT overwrite an existing value on a re-join, and MUST ignore an inviter id that does not belong to an existing member of the same group.

#### Scenario: Joining via a valid invite link
- **WHEN** a user joins a group through an invite link whose inviter id belongs to an existing member of that group, and the user is not already a member
- **THEN** a `group_members` row is created with `invited_by_user_id` set to that inviter
- **AND** the user is added to the group as before

#### Scenario: Self-credit is rejected
- **WHEN** the supplied inviter id equals the joining user's own id
- **THEN** the membership is still created
- **AND** `invited_by_user_id` is left null

#### Scenario: Inviter is not a member of the group
- **WHEN** the supplied inviter id does not belong to any current member of the group being joined
- **THEN** the membership is still created
- **AND** `invited_by_user_id` is left null

#### Scenario: Manual code entry has no inviter
- **WHEN** a user joins by entering a join code manually (no inviter supplied)
- **THEN** the membership is created with `invited_by_user_id` null

#### Scenario: Re-join does not overwrite the inviter
- **WHEN** a user who is already a member calls join again (with or without an inviter id)
- **THEN** no new membership row is created
- **AND** any existing `invited_by_user_id` is left unchanged

### Requirement: Award a referral bonus recorded separately from prediction scores
The system SHALL, on the first successful invited join (a new membership row created with a valid, distinct, already-member inviter), record a referral reward in a dedicated `public.group_referrals` table that names the inviter, the invitee, the group, and a fixed bonus point value. The reward SHALL credit both the inviter and the invitee. The reward MUST be recorded exactly once per `(group_id, invitee_id)` pair. The system MUST NOT write any row to `public.scores` for a referral and MUST NOT modify `compute_match_scores`, `v_leaderboard_overall`, or `leaderboard_for_group`.

#### Scenario: First invited join awards both parties
- **WHEN** a user completes a first-time join of a group with a valid, distinct inviter who is already a member
- **THEN** exactly one `group_referrals` row is written for `(group_id, invitee_id)` recording the inviter, the invitee, and the fixed bonus
- **AND** both the inviter and the invitee are credited the referral bonus

#### Scenario: No referral when there is no valid inviter
- **WHEN** a join has no inviter, a self-referencing inviter, or an inviter who is not a member of the group
- **THEN** no `group_referrals` row is written
- **AND** the user still joins the group

#### Scenario: Award is idempotent per invitee per group
- **WHEN** a join that would award a referral is attempted but a `group_referrals` row already exists for that `(group_id, invitee_id)`
- **THEN** no second `group_referrals` row is written and no additional bonus is credited

#### Scenario: Competitive leaderboard is unaffected
- **WHEN** a referral bonus is awarded
- **THEN** no row is added to `public.scores`
- **AND** the values returned by `v_leaderboard_overall` and `leaderboard_for_group` are unchanged by the referral

### Requirement: Invite links carry the inviter and the join flow forwards it
The invite/copy-link affordance for a group SHALL produce a link that includes the current user's id as a `ref` query parameter (`?ref=<inviterId>`). The invite-link landing page (`join/[code]`) SHALL read the `ref` parameter and forward it through the join confirmation so that the join action passes it to `join_group` as `p_invited_by`. The join action SHALL validate the forwarded value as a UUID and drop it if malformed. The manual code-entry join form SHALL NOT supply an inviter.

#### Scenario: Copy-link includes the current user as inviter
- **WHEN** a signed-in member copies the invite link for a group
- **THEN** the copied URL includes `?ref=<the member's own user id>`

#### Scenario: Landing page forwards a valid ref
- **WHEN** the invite-link landing page is opened with a `ref` query parameter that is a valid UUID and the user confirms the join
- **THEN** that id is forwarded to `join_group` as `p_invited_by`

#### Scenario: Malformed ref is dropped
- **WHEN** the join action receives a `ref` value that is not a valid UUID
- **THEN** the value is dropped and the join proceeds with no inviter

### Requirement: Referral joins are measurable
The system SHALL emit a `group_referral` client-side analytics event (via `trackEvent`) when an invited join settles successfully, in addition to the existing `group_joined` event. The event payload MUST NOT include the raw join code or other PII, consistent with the existing `group_joined` emission.

#### Scenario: Invited join emits the referral event
- **WHEN** a join initiated from an invite link carrying a `ref` settles without error
- **THEN** a `group_referral` analytics event is emitted alongside `group_joined`

#### Scenario: Manual join does not emit the referral event
- **WHEN** a join from the manual code-entry form (no inviter) settles
- **THEN** only `group_joined` is emitted and `group_referral` is not
