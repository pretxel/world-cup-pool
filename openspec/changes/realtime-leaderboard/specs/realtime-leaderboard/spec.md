## ADDED Requirements

### Requirement: Leaderboard updates live on score changes

The public `/leaderboard` page SHALL subscribe to Supabase Realtime change events on the `public.scores` base table and, on receiving a change event, SHALL re-fetch `v_leaderboard_overall` and update the displayed standings without a manual page reload. The client MUST NOT re-derive ranks, tie-breaks, or admin exclusion on its own; the re-fetched `v_leaderboard_overall` is the source of truth for the rendered rows.

#### Scenario: Standings refresh when a score is computed
- **WHEN** a signed-in user is viewing `/leaderboard` and a row is written to `public.scores` (e.g. by `compute_match_scores()` after a result)
- **THEN** the client receives a Realtime change event and re-fetches `v_leaderboard_overall`
- **AND** the on-screen standings update to the re-fetched ranks and points without the user reloading the page

#### Scenario: Ranks come from the view, not the client
- **WHEN** a Realtime change event arrives
- **THEN** the displayed ranks, tie-breaks, and admin exclusion reflect a fresh `v_leaderboard_overall` query
- **AND** the client does not compute ranks locally from raw score rows

#### Scenario: Bursts of score writes coalesce into one refresh
- **WHEN** computing a single match writes many `public.scores` rows in quick succession
- **THEN** the client coalesces the burst (debounce) into a single `v_leaderboard_overall` re-fetch rather than one re-fetch per event

### Requirement: Scores table is in the Realtime publication

A database migration SHALL add `public.scores` to the `supabase_realtime` publication so that `postgres_changes` events are emitted for it, since `v_leaderboard_overall` is a view and cannot be subscribed to directly. The migration MUST be safe to run when `public.scores` is already a member of the publication.

#### Scenario: Migration enables change events for scores
- **WHEN** the migration that adds `public.scores` to `supabase_realtime` has been applied
- **THEN** inserts, updates, and deletes on `public.scores` produce Realtime `postgres_changes` events
- **AND** the leaderboard client can subscribe to those events

#### Scenario: Migration is idempotent
- **WHEN** the migration runs against a database where `public.scores` is already in the `supabase_realtime` publication
- **THEN** the migration completes without error and does not duplicate the table in the publication

### Requirement: SSR snapshot remains the initial render and graceful fallback

The leaderboard SHALL keep its server-rendered standings as the first paint, seeding the live component's initial rows. If the Realtime channel never connects or no events arrive, the page SHALL continue to display the SSR snapshot with no error and no degraded behavior.

#### Scenario: First paint matches today's SSR output
- **WHEN** `/leaderboard` is requested
- **THEN** the server renders the standings from `v_leaderboard_overall` as it does today
- **AND** those rows seed the live component as its initial state

#### Scenario: Realtime unavailable falls back silently
- **WHEN** Supabase Realtime is unavailable or the subscription fails to connect
- **THEN** the page still displays the SSR standings
- **AND** no error is surfaced to the user

#### Scenario: Anonymous visitor sees the static snapshot
- **WHEN** a signed-out visitor opens `/leaderboard`
- **THEN** the SSR standings render correctly
- **AND** the absence of authenticated Realtime delivery does not break the page

### Requirement: Shared leaderboard table stays presentational

The live subscription logic SHALL live in a client wrapper component, not inside the shared `LeaderboardTable` component. `LeaderboardTable` MUST remain presentational and namespace-agnostic so that the per-group mini board that reuses it does not inherit any Realtime behavior from this change.

#### Scenario: Group mini board is unaffected
- **WHEN** a per-group mini board renders using the shared `LeaderboardTable`
- **THEN** it does not open a Realtime subscription as a result of this change
- **AND** its rendering behavior is unchanged

#### Scenario: Live wrapper owns the subscription and cleanup
- **WHEN** the live leaderboard wrapper mounts on `/leaderboard`
- **THEN** it opens exactly one Realtime channel for `public.scores`
- **AND** it removes the channel on unmount to avoid leaked subscriptions
