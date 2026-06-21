## ADDED Requirements

### Requirement: Bracket updates live when match data changes

The bracket page SHALL update its rendered bracket without a manual reload when `public.matches` changes (e.g. a knockout match finalizes). It SHALL do so by refreshing the server-rendered bracket (the server remains the single source of truth for allocation, provisional projections, and match-number resolution); the client SHALL NOT re-derive the bracket. `public.matches` SHALL be a member of the Realtime publication so changes are delivered.

#### Scenario: Knockout result advances without reload
- **WHEN** a viewer has `/bracket` open and a knockout match finalizes
- **THEN** the bracket refreshes and shows the winner advanced (and any third-place reshuffle) without the viewer reloading

#### Scenario: Debounced refresh on bursts
- **WHEN** several match rows change in quick succession (e.g. a sync run)
- **THEN** the bracket performs a single coalesced refresh rather than one per row

#### Scenario: Graceful without Realtime
- **WHEN** Realtime is unavailable or never connects
- **THEN** the bracket still renders correctly and reflects results on normal reload/navigation, with no error
