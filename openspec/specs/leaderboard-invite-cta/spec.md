## Purpose

Surface a contextual "invite friends / create a group" call-to-action on the signed-in `/leaderboard` page so that a high-intent player looking at their own rank can grow group membership without an extra navigation hop. The CTA is a navigational entry point to the existing groups create/join surface; it adds no new invite channel, data fetch, or SQL/view change.

## Requirements

### Requirement: Signed-in leaderboard shows an invite/create-group CTA

The public `/leaderboard` page SHALL render an "invite friends / create a group" call-to-action for signed-in users, placed near the player's own context (their highlighted row or the existing "share your rank" area). The CTA SHALL link to the groups create/join surface at `localePath(locale, "/groups")`. The CTA MUST reuse the page's existing current-user context and locale-aware navigation and MUST NOT trigger any additional data fetch or SQL/view change.

#### Scenario: Signed-in user on the board sees the CTA
- **WHEN** a signed-in user whose row appears on the leaderboard opens `/leaderboard`
- **THEN** an "invite friends / create a group" CTA is shown near their own context
- **AND** activating the CTA navigates to the locale-aware `/groups` create/join surface

#### Scenario: Signed-in user not yet on the board still sees the CTA
- **WHEN** a signed-in user who has no row on the leaderboard opens `/leaderboard` while the board has at least one player
- **THEN** the invite/create-group CTA is still shown
- **AND** activating the CTA navigates to the locale-aware `/groups` create/join surface

#### Scenario: CTA preserves the active locale
- **WHEN** a signed-in user viewing `/leaderboard` in a non-default locale activates the CTA
- **THEN** the destination URL is `/groups` prefixed with that active locale via `localePath`

### Requirement: CTA is hidden for signed-out visitors and the empty state

The invite/create-group CTA SHALL NOT render for signed-out visitors. The leaderboard empty-state branch (no ranked players) SHALL remain unchanged by this CTA.

#### Scenario: Signed-out visitor sees no CTA
- **WHEN** a signed-out visitor opens `/leaderboard`
- **THEN** the invite/create-group CTA is not rendered
- **AND** the standings, leader card, and existing content render unchanged

#### Scenario: Empty board is unaffected
- **WHEN** `/leaderboard` has no ranked players and renders its empty state
- **THEN** the empty state renders as before
- **AND** no invite/create-group CTA is added to it

### Requirement: Shared leaderboard table stays presentational

The CTA SHALL live in the leaderboard page rather than inside the shared `LeaderboardTable` component, so that the per-group mini board that reuses `LeaderboardTable` does not inherit the create-a-group CTA.

#### Scenario: Group mini board does not show the create-group CTA
- **WHEN** a group mini board renders using the shared `LeaderboardTable`
- **THEN** no "invite friends / create a group" CTA is added by this change
