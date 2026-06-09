# match-team-filter — Delta Spec

## ADDED Requirements

### Requirement: Status filter via interactive header stats
The `/matches` page SHALL let the user filter the match list by status — `upcoming`, `live`, or `final` — by activating the corresponding header stat card, which SHALL behave as a single-select toggle (`aria-pressed` button). The active status SHALL be encoded as a `status` query parameter; activating the active card again SHALL clear the filter and remove the parameter. Unknown `status` values SHALL be ignored, rendering the unfiltered set. The status filter SHALL compose with the team filter: when both are active, only matches satisfying both SHALL render.

#### Scenario: Select live
- **WHEN** the user activates the "Live" stat card
- **THEN** the URL gains `status=live` and only matches with live status render
- **AND** the "Live" card is shown active (`aria-pressed="true"`)

#### Scenario: Toggle off
- **WHEN** `status=final` is active and the user activates the "Final" card again
- **THEN** the `status` parameter is removed and all statuses render

#### Scenario: Switch selection
- **WHEN** `status=live` is active and the user activates "Upcoming"
- **THEN** the URL parameter becomes `status=upcoming` (single-select, not additive)

#### Scenario: Composes with team filter
- **WHEN** the URL is `/matches?team=Brazil&status=final`
- **THEN** only final-status matches involving Brazil render

#### Scenario: Unknown status ignored
- **WHEN** a user opens `/matches?status=banana`
- **THEN** the page does not error and no status filter is applied

### Requirement: Needs-pick filter for signed-in users
For signed-in users, the `/matches` page SHALL offer a "needs my pick" toggle that filters the list to matches the user has not predicted AND that are still open for picks (scheduled and unlocked). The toggle SHALL display a count of such matches computed from the team-filtered set. The active state SHALL be encoded as `picks=needed` in the URL. The control SHALL NOT render for anonymous visitors, and a `picks` parameter on an anonymous request SHALL be ignored. The filter SHALL compose with the team and status filters.

#### Scenario: Filter to unpicked open matches
- **WHEN** a signed-in user with 3 unpicked open matches activates the needs-pick toggle
- **THEN** the URL gains `picks=needed` and exactly those 3 matches render

#### Scenario: Count badge reflects team filter
- **WHEN** the team filter is set to Brazil and the user has 2 unpicked open Brazil matches
- **THEN** the needs-pick toggle's count reads 2

#### Scenario: Hidden for anonymous visitors
- **WHEN** an anonymous visitor views `/matches`
- **THEN** no needs-pick control is rendered

#### Scenario: Anonymous request with picks param
- **WHEN** an anonymous visitor opens `/matches?picks=needed`
- **THEN** the page does not error and the parameter is ignored (unfiltered by picks)

#### Scenario: Locked unpicked match excluded
- **WHEN** a signed-in user has not picked a match whose pick deadline has passed
- **THEN** that match is not included in the needs-pick filtered set or count

## MODIFIED Requirements

### Requirement: Header stats and day counts reflect the filtered set

The header stat cards SHALL display three buckets — `upcoming` (scheduled plus locked), `live`, and `final` — whose counts sum to the total of the team-filtered list (cancelled matches excepted). The stat counts SHALL be computed from the team-filtered list before status filtering is applied, so each card shows what activating it would yield. Each matchday's match-count label SHALL be computed from the fully filtered list, so the displayed totals always match the rows shown for the current selection.

#### Scenario: Stats follow the team filter
- **WHEN** the user selects a team whose fixtures include 1 live and 2 final matches and nothing else
- **THEN** the header live stat reads 1 and the final stat reads 2
- **AND** the totals do not count fixtures hidden by the team filter

#### Scenario: Locked matches count as upcoming
- **WHEN** the team-filtered list contains 4 scheduled, 2 locked, 1 live, and 3 final matches
- **THEN** the upcoming stat reads 6, live reads 1, final reads 3

#### Scenario: Stats stable under status selection
- **WHEN** the user activates the "Final" stat card
- **THEN** the three stat counts do not change (they reflect the pre-status-filter distribution)

### Requirement: Filter-aware empty state

When any filter (team, status, or needs-pick) is active and no fixture matches the combined selection, the page SHALL render an empty state that communicates the selection matched no fixtures and offers a way to clear all active filters. This SHALL be distinct from the empty state shown when the schedule itself contains no matches.

#### Scenario: No fixtures for combined selection
- **WHEN** filters are active and no fixture satisfies them
- **THEN** a "no matches for the current filters" empty state is rendered with a clear-filters affordance
- **AND** the generic "no matches scheduled" copy is not shown

#### Scenario: Clear removes all filter params
- **WHEN** the user activates the clear-filter affordance while `team`, `status`, and `picks` parameters are present
- **THEN** all three parameters are removed and the full list renders

### Requirement: Filter UI strings are localized

All user-facing strings introduced by the match list filters (team filter label, "All" option, stat card labels including "upcoming", needs-pick toggle label and count, filtered empty state, clear-filter affordance) SHALL be provided through the existing `matches` i18n namespace and resolved for the active locale, with entries present in every supported locale message file.

#### Scenario: Localized label in each locale
- **WHEN** the matches page is rendered in `en`, `es`, and `fr`
- **THEN** the filter control labels, stat card labels, and needs-pick toggle render localized text from that locale's `matches` namespace (no missing-key fallback)
