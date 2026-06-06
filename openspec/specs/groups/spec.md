# groups Specification

## Purpose
TBD - created by archiving change friends-groups-mini-boards. Update Purpose after archive.
## Requirements
### Requirement: Create a group
A signed-in user SHALL be able to create a friend group with a display name. On creation the system SHALL persist a `groups` row owned by the creator, generate a unique `join_code`, and record the creator as a member with `role='owner'`.

#### Scenario: Owner creates a group
- **WHEN** a signed-in user submits a group name
- **THEN** the system creates a `groups` row with that name and `owner_id` set to the user
- **AND** creates a `group_members` row for the user with `role='owner'`
- **AND** assigns a unique `join_code` to the group

#### Scenario: Join code is unambiguous and unique
- **WHEN** the system generates a `join_code`
- **THEN** the code excludes visually ambiguous characters (`0`, `O`, `1`, `I`, `L`)
- **AND** the code is unique across all groups, regenerating on collision

#### Scenario: Anonymous visitor cannot create a group
- **WHEN** a request without an authenticated session attempts to create a group
- **THEN** the system rejects the request and creates no `groups` row

### Requirement: Join a group by code
A signed-in user SHALL be able to join a group by supplying its `join_code` through the `join_group` operation, which adds **only the calling user** as a `role='member'`. Direct insertion into `group_members` SHALL NOT be available to end users.

#### Scenario: Valid code joins the caller
- **WHEN** a signed-in user calls `join_group` with a valid `join_code`
- **THEN** the system inserts a `group_members` row for the calling user in the resolved group with `role='member'`
- **AND** returns the joined group's id

#### Scenario: Caller is added only as themselves
- **WHEN** a signed-in user calls `join_group`
- **THEN** the inserted `user_id` is the caller's own id and cannot be set to another user

#### Scenario: Invalid code is rejected
- **WHEN** a signed-in user calls `join_group` with a code that matches no group
- **THEN** the system adds no membership and reports that the code is invalid

#### Scenario: Joining is idempotent
- **WHEN** a user who is already a member calls `join_group` with the same valid code
- **THEN** the system makes no duplicate membership and the user remains a single member of the group

#### Scenario: Direct table insert is blocked
- **WHEN** an authenticated user attempts to insert a `group_members` row directly (outside `join_group`)
- **THEN** the system denies the insert

### Requirement: Group mini board ranks only members
The system SHALL expose a per-group leaderboard that ranks only that group's members, using the same points and tie-breakers as the global overall leaderboard, with rank recomputed within the group. A member's full history of scored matches SHALL count regardless of when they joined.

#### Scenario: Ranking scoped to members
- **WHEN** a member opens a group's board
- **THEN** the system returns one row per group member who has at least one `scores` row, ordered by `total_points` descending
- **AND** users who are not members of the group are absent from the board
- **AND** `rank` is computed within the group, so the top member is rank 1 regardless of global standing

#### Scenario: Same tie-breakers as the global board
- **WHEN** two members have equal `total_points` on a group board
- **THEN** the system breaks the tie using more exact hits, then more winner-with-goal-difference hits, then earliest submission timestamp — identical to the global leaderboard

#### Scenario: Whole-tournament scoring for late joiners
- **WHEN** a user joins a group after some matches are already `final`
- **THEN** their points from those earlier `final` matches count toward the group board

#### Scenario: Member with no scored matches
- **WHEN** a group member has no `scores` rows yet
- **THEN** the system omits them from the ranked board rows
- **AND** if that member is the viewer, their personal context shows "Not yet ranked"

#### Scenario: Board with no completed matches
- **WHEN** a member opens a group's board and no member has any scored matches
- **THEN** the system renders an empty state and lists no members

### Requirement: Group and board visibility limited to members
The system SHALL allow only a group's members to read that group's record, member list, and mini board. Non-members SHALL NOT be able to read a group's board or membership.

#### Scenario: Member reads the board
- **WHEN** a member requests their group's board
- **THEN** the system returns the group's details and ranked rows

#### Scenario: Non-member is denied the board
- **WHEN** a signed-in user who is not a member requests a group's board
- **THEN** the system returns no board rows for that group

#### Scenario: Join preview before membership
- **WHEN** a signed-in user opens an invite link `/groups/join/<code>` for a group they have not joined
- **THEN** the system shows the group's name and a confirm-join action without exposing the member-scoped board

### Requirement: Group membership lifecycle
The system SHALL let a member leave a group, and let a group's owner rename the group, remove a member, and delete the group. An owner SHALL NOT leave a group while other members remain; to exit, the owner deletes the group. Deleting a group SHALL remove all of its memberships.

#### Scenario: Member leaves
- **WHEN** a member who is not the owner leaves a group
- **THEN** the system removes that user's `group_members` row and they no longer appear on the board

#### Scenario: Owner renames the group
- **WHEN** the owner submits a new name for their group
- **THEN** the system updates the group's name

#### Scenario: Owner removes a member
- **WHEN** the owner removes another member from their group
- **THEN** the system deletes that member's `group_members` row

#### Scenario: Non-owner cannot remove or rename
- **WHEN** a non-owner member attempts to rename the group or remove another member
- **THEN** the system denies the action

#### Scenario: Owner cannot leave while members remain
- **WHEN** the owner attempts to leave a group that still has other members
- **THEN** the system denies the leave and directs the owner to delete the group instead

#### Scenario: Deleting a group cascades memberships
- **WHEN** the owner deletes a group
- **THEN** the system removes the group and all of its `group_members` rows

