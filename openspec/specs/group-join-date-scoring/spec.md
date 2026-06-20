# group-join-date-scoring Specification

## Purpose

A friend group's mini board ranks each member using only the scores for matches that kicked off on or after that member joined the group, while the global leaderboard remains whole-tournament. This re-levels late joiners (who otherwise inherit an unreachable deficit on the most viral surface) without altering the canonical all-time ranking. The group board keeps the same row shape, member-only visibility, competition scope, and tie-breakers as before; only the group-scoped aggregate gains the per-member join-date filter, and the group page explains the new semantics.

## Requirements

### Requirement: Group board scores each member from their own join date

The `leaderboard_for_group(p_group_id uuid)` RPC SHALL aggregate, for each member of the group, only the scores for matches whose `kickoff_at` is on or after that member's own `group_members.joined_at`. The join-date cutoff SHALL be per member, so two members of the same group MAY be scored over different sets of matches. A match whose `kickoff_at` is strictly before a member's `joined_at` MUST NOT contribute to that member's `total_points`, `exact_hits`, `winner_gd_hits`, `winner_hits`, or `first_submit`.

#### Scenario: Late joiner is not scored for pre-join matches
- **WHEN** a member joined a group after several matches had already kicked off and finaled
- **THEN** that member's group `total_points` and hit counts reflect only matches whose `kickoff_at` is on or after their `joined_at`
- **AND** their group total is independent of any points they earned on matches that kicked off before they joined

#### Scenario: Founder present from the start is scored for the whole tournament
- **WHEN** a group's owner has a `joined_at` that precedes every scored match in the competition
- **THEN** the owner's group aggregate includes every one of their scored matches
- **AND** the owner's group board is identical to whole-tournament scoring for that owner

#### Scenario: Per-member cutoffs differ within one group
- **WHEN** two members of the same group have different `joined_at` values
- **THEN** each member is aggregated over their own post-join matches
- **AND** the earlier joiner MAY count matches that the later joiner does not

#### Scenario: Match at the exact join instant counts
- **WHEN** a match's `kickoff_at` equals a member's `joined_at`
- **THEN** that match contributes to the member's group aggregate

### Requirement: Group board preserves shape, visibility, scope, and tie-breakers

The join-date filter SHALL be the only behavioral change to `leaderboard_for_group`. The RPC SHALL keep its `RETURNS TABLE (user_id, display_name, total_points, exact_hits, winner_gd_hits, winner_hits, first_submit, rank)` shape, its `security definer` posture, its `is_group_member(p_group_id)` membership guard, its scope to the group's own `competition_id`, and its tie-breaker order (total points, then exact hits, then winner+goal-difference hits, then earliest `first_submit`). A non-member calling the RPC SHALL receive no rows. Ranks within the returned set SHALL be contiguous after the filter is applied.

#### Scenario: Row shape and caller are unchanged
- **WHEN** a member loads their group board via `getGroupBoard`
- **THEN** each row carries `user_id`, `display_name`, `total_points`, `exact_hits`, `winner_gd_hits`, `winner_hits`, `first_submit`, and `rank`
- **AND** no change to the RPC name, parameters, or return columns is required of the caller

#### Scenario: Non-members still see nothing
- **WHEN** a user who is not a member of the group calls `leaderboard_for_group` for that group
- **THEN** the RPC returns zero rows

#### Scenario: Ranks reflect post-join totals and tie-breakers
- **WHEN** the group board is ranked after applying the per-member join-date filter
- **THEN** members are ordered by post-join total points, then exact hits, then winner+GD hits, then earliest first submit
- **AND** the rank values over the returned members are contiguous

### Requirement: Global leaderboard remains whole-tournament and unchanged

This change SHALL NOT alter the global leaderboard `v_leaderboard_overall`, the per-day function `leaderboard_for_day`, the segmented leaderboard functions, the `scores` and `predictions` tables, or `compute_match_scores`. A user's global all-time point total SHALL be unaffected by join-date scoring; only the group-scoped ranking changes.

#### Scenario: Global total ignores group join dates
- **WHEN** a user is a late joiner in one or more groups
- **THEN** their position and points on the global `/leaderboard` reflect every scored match they have, regardless of any group join date

#### Scenario: A member's group and global totals may differ
- **WHEN** a late joiner views both their group board and the global leaderboard
- **THEN** their group total MAY be lower than their global total because the group counts only post-join matches
- **AND** the global total is unchanged by this feature

### Requirement: Group page explains join-date scoring

The group detail page SHALL communicate that the board scores each member from when they joined the group. When a signed-in member has joined but has no post-join scored matches yet, the page SHALL show the existing not-yet-ranked / empty-state copy rather than implying an error. The explainer and any new copy SHALL be localized in every supported locale (en, es, fr, de).

#### Scenario: Explainer is shown on the group board
- **WHEN** a member views their group's mini board
- **THEN** the page shows copy stating that members are scored from when they joined the group

#### Scenario: Freshly joined member with no counted matches
- **WHEN** a signed-in member has joined the group but has no matches that kicked off on or after their `joined_at` scored yet
- **THEN** the page shows the not-yet-ranked / empty-state copy
- **AND** does not present the absence of a ranked row as an error

#### Scenario: Localized copy
- **WHEN** the group page renders in any supported locale (en, es, fr, de)
- **THEN** the join-date-scoring explainer and related copy are shown in that locale's translation
