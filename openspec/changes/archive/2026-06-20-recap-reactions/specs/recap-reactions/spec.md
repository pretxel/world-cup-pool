## ADDED Requirements

### Requirement: Authenticated emoji reactions on recap comics

A signed-in user SHALL be able to add an emoji reaction to the active recap of a `final` match by tapping a reaction in the reaction bar on the match detail page, and SHALL be able to remove a reaction they previously added by tapping it again (toggle). The reaction type MUST be one of a fixed server-enforced allowlist; a reaction outside the allowlist MUST be rejected. A user MUST hold each reaction type at most once per recap version, enforced by a database uniqueness constraint on `(user_id, summary_id, reaction)`, so a user cannot inflate a count.

#### Scenario: Signed-in user adds a reaction
- **WHEN** a signed-in user taps an allowed reaction under the recap comic of a final match
- **THEN** a `recap_reactions` row for that user, the active `summary_id`, and that reaction is created
- **AND** the bar shows the reaction as selected for that user and the type's count increases by one

#### Scenario: Tapping again removes the reaction
- **WHEN** a signed-in user taps a reaction they have already added
- **THEN** their `recap_reactions` row for that `(summary_id, reaction)` is removed
- **AND** the bar shows the reaction as no longer selected for that user and the type's count decreases by one

#### Scenario: Duplicate of the same reaction is rejected
- **WHEN** a write would create a second `recap_reactions` row for the same `(user_id, summary_id, reaction)`
- **THEN** the uniqueness constraint rejects it and the count does not increase beyond one for that user and type

#### Scenario: Reaction outside the allowlist is rejected
- **WHEN** a write attempts a reaction value that is not in the fixed allowlist
- **THEN** the write is rejected (by the table `check` constraint and the server-side allowlist check) and no row is created

### Requirement: Public, active-version-scoped reaction counts

Aggregate reaction counts per type SHALL be readable by anonymous and authenticated users, scoped to the **active** recap version, mirroring how `match_summary_images` exposes only the active render. Counts for draft or non-active recap versions MUST NOT be exposed. A signed-in viewer SHALL additionally be able to read which reaction types they themselves have added.

#### Scenario: Anonymous visitor reads counts
- **WHEN** an anonymous visitor views the match detail page for a final match with reactions
- **THEN** the per-type aggregate counts for the active recap version are visible
- **AND** the visitor sees a sign-in prompt instead of an interactive toggle

#### Scenario: Signed-in viewer sees their own reactions reflected
- **WHEN** a signed-in user views a recap they have reacted to
- **THEN** the reactions they added are shown as selected
- **AND** the displayed counts reflect the active recap version

#### Scenario: Draft version reactions stay hidden
- **WHEN** a recap has reactions on a version that is not the active version
- **THEN** those reactions are not included in the public counts exposed to viewers

### Requirement: Reactions accepted only for the active version of a final match

A reaction write SHALL be accepted only when its `summary_id` is the active recap version of a match whose `status` is `final`, enforced in SQL (RLS `with check` and/or the toggle function) so it holds regardless of which client performs the write. Reactions MUST NOT be accepted for non-final matches or for non-active recap versions.

#### Scenario: Reaction on a non-final match is rejected
- **WHEN** a write attempts a reaction whose match is not `final`
- **THEN** the write is rejected and no row is created

#### Scenario: Reaction on a non-active version is rejected
- **WHEN** a write attempts a reaction whose `summary_id` is not the active version of its match
- **THEN** the write is rejected and no row is created

### Requirement: Reactions are own-row only under RLS

Row Level Security SHALL be enabled on `recap_reactions`. An authenticated user MAY insert and delete only rows whose `user_id` equals `auth.uid()`, and MAY select their own rows; the aggregate counts are exposed only through the public counts read path, not by granting broad row select. A user MUST NOT be able to create, delete, or read another user's reaction rows directly.

#### Scenario: User cannot delete another user's reaction
- **WHEN** an authenticated user attempts to delete a `recap_reactions` row whose `user_id` is not their own
- **THEN** RLS rejects the delete and the other user's reaction is unchanged

#### Scenario: User cannot insert a reaction as another user
- **WHEN** an authenticated user attempts to insert a row with a `user_id` other than `auth.uid()`
- **THEN** the RLS `with check` rejects the insert

### Requirement: Per-user rate limit on reaction toggling

Reaction toggling SHALL be subject to a per-user rate limit on a rolling time window to block flip-spam, applied server-side (a counted ledger or a SECURITY DEFINER toggle function, same posture as `group_invite_log`). Normal add/remove use MUST NOT be blocked; only abusive churn beyond the cap is rejected.

#### Scenario: Excessive toggling is throttled
- **WHEN** a user toggles reactions more times than the rolling-window cap allows
- **THEN** further toggles in that window are rejected without affecting the persisted counts
- **AND** normal occasional toggling continues to succeed

### Requirement: Reaction counts surfaced on the match detail page

The match detail page SHALL render a reaction bar within the existing recap (`matchSummary`) section, which is already gated on `match.status === "final"` and a completed comic render. The bar SHALL display the per-type aggregate counts and, for a signed-in viewer, the viewer's own selected reactions, seeded from a server-side read so the first paint is correct without client JavaScript.

#### Scenario: Reaction bar renders under the comic
- **WHEN** the match detail page renders a final match with an active recap comic
- **THEN** a reaction bar with per-type counts appears in the recap section
- **AND** the counts are server-rendered as the initial state

#### Scenario: No reaction bar without a recap
- **WHEN** a match has no active recap comic (not final, or no completed render)
- **THEN** no reaction bar is rendered

### Requirement: Aggregate reaction count surfaced on the landing gallery

The landing recap gallery (`components/recent-recap-images.tsx`) SHALL display an aggregate reaction count on each comic card as social proof, summed for the active recap version of that match. The gallery card MUST remain a link to the match detail page; reacting is not performed from the gallery.

#### Scenario: Gallery card shows a reaction count
- **WHEN** the landing gallery renders a comic that has reactions
- **THEN** the card shows the total reaction count for that recap
- **AND** tapping the card navigates to the match detail page where the full reaction bar lives

#### Scenario: Gallery card with no reactions
- **WHEN** a comic in the gallery has no reactions
- **THEN** the card renders without a misleading count (zero or no badge) and the gallery layout is unaffected

### Requirement: Reaction events are instrumented for analytics

Adding and removing a reaction SHALL emit client-side analytics events through the existing `trackEvent` wrapper, consistent with the existing `share_click` / `prediction_submitted` events, so recap engagement becomes measurable. Emitting an event MUST never block or break the toggle (the wrapper is a silent no-op when analytics is unavailable).

#### Scenario: Adding a reaction emits an event
- **WHEN** a user successfully adds a reaction
- **THEN** a `recap_reaction_added` event is emitted with the reaction type and match id

#### Scenario: Removing a reaction emits an event
- **WHEN** a user successfully removes a reaction
- **THEN** a `recap_reaction_removed` event is emitted with the reaction type and match id

### Requirement: Optional live reaction counts via Supabase Realtime

The reaction counts MAY be made live: when enabled, a migration SHALL add `public.recap_reactions` to the `supabase_realtime` publication (idempotent guard), and the match-detail reaction bar SHALL subscribe to change events and re-fetch the authoritative counts on change with a debounce, never re-deriving counts purely from raw events. If Realtime is unavailable or the channel never connects, the bar SHALL fall back silently to the server-rendered counts with no error.

#### Scenario: Counts update live when another user reacts
- **WHEN** live counts are enabled and another user adds a reaction to the recap a signed-in viewer is looking at
- **THEN** the viewer's bar receives a change event, re-fetches the counts, and updates without a manual reload

#### Scenario: Realtime unavailable falls back to the snapshot
- **WHEN** Realtime is unavailable or the subscription fails to connect
- **THEN** the reaction bar continues to display the server-rendered counts
- **AND** no error is surfaced to the user

### Requirement: Reactions do not affect competitive scoring

Reactions SHALL have no effect on points, predictions, `public.scores`, `compute_match_scores()`, or any leaderboard view. Reacting or un-reacting MUST NOT change any player's standing.

#### Scenario: Reacting does not change standings
- **WHEN** a user adds or removes any reaction
- **THEN** no row is written to `public.scores` and no leaderboard rank or point total changes as a result
