## ADDED Requirements

### Requirement: Competitions registry

The system SHALL store competitions in a `public.competitions` table, each with a unique `slug`, display `name`/`short_name`, `season`, `tournament_start_at`, opening-fixture fallback fields, `format_config` (JSONB), `providers` (JSONB), `branding` (JSONB), and an `is_active` boolean.

#### Scenario: World Cup 2026 seeded as a competition

- **WHEN** the migrations and seed run
- **THEN** a `competitions` row with `slug = 'world-cup-2026'` exists
- **AND** its `format_config` encodes the legacy stages (`group,r32,r16,qf,sf,third,final`) and group pattern `^[A-L]$`

#### Scenario: Adding a competition requires no code change

- **WHEN** an operator inserts a new `competitions` row with a valid `format_config`
- **THEN** the insert succeeds without any application code or DDL change

### Requirement: At most one active competition

The system SHALL guarantee that no more than one competition has `is_active = true` at any time, enforced by a partial unique index on `(is_active) WHERE is_active`.

#### Scenario: Second active competition rejected

- **WHEN** a write attempts to set `is_active = true` on a second competition while another is already active
- **THEN** the database rejects the write with a unique-violation

### Requirement: Active competition switched only via a guarded RPC

The system SHALL expose `set_active_competition(p_id uuid)` as the sole mutation path for `is_active`. It SHALL require admin privileges, raise if `p_id` does not exist, and flip the active flag in a single statement so the single-active invariant always holds.

#### Scenario: Admin switches the active competition

- **WHEN** an admin calls `set_active_competition` with an existing competition id
- **THEN** that competition becomes the only one with `is_active = true`
- **AND** affected paths and the leaderboard cache tag are revalidated

#### Scenario: Non-admin cannot switch

- **WHEN** a non-admin user calls `set_active_competition`
- **THEN** the call is rejected and no `is_active` value changes

#### Scenario: Unknown competition id raises

- **WHEN** `set_active_competition` is called with an id that does not exist
- **THEN** the function raises an error
- **AND** the previously active competition remains active

### Requirement: Active competition resolution helper

The system SHALL provide `active_competition_id()` (SQL, `stable`, `security definer`, granted to anon and authenticated) returning the id of the active competition, and a request-cached `getActiveCompetition()` in the application layer, used by views, RLS, domain, UI, sync, and branding.

#### Scenario: Helper returns the active competition

- **WHEN** `active_competition_id()` is evaluated while `world-cup-2026` is active
- **THEN** it returns that competition's id

#### Scenario: No active competition

- **WHEN** no competition has `is_active = true`
- **THEN** `active_competition_id()` returns NULL
- **AND** `getActiveCompetition()` resolves to a "no competition selected" state without throwing

### Requirement: Managed competition context (admin-only) distinct from the active competition

The admin SHALL maintain a managed-competition context that is independent of the public active competition. It SHALL be persisted in an httpOnly, sameSite=lax, admin-only cookie and resolved server-side by `getManagedCompetition()` (request-cached, loaded via the service-role client so a non-active competition is readable). When the cookie is absent, invalid, or points to a deleted competition, resolution SHALL fall back to `active_competition_id()` and clear the stale cookie. Switching managed SHALL be a non-destructive `setManagedCompetition(id)` server action that validates the id exists, sets the cookie, and revalidates the admin layout; it SHALL NOT modify `is_active`.

#### Scenario: Default managed equals active

- **WHEN** an admin with no managed cookie set opens the admin while only `world-cup-2026` exists
- **THEN** the managed competition resolves to `world-cup-2026` (the active competition)
- **AND** no behavior differs from before

#### Scenario: Switching managed never changes public

- **WHEN** an admin selects a non-active competition as managed
- **THEN** the cookie updates and the admin scope changes
- **AND** `is_active` and what end users see are unchanged

#### Scenario: Stale managed cookie falls back

- **WHEN** the managed cookie points to a competition that was deleted
- **THEN** `getManagedCompetition()` falls back to the active competition and clears the stale cookie without throwing

### Requirement: Active-vs-managed surfaced unmistakably across the admin

Every admin page SHALL display both the active competition (public) and the managed competition (editing context). When they coincide it SHALL render a calm `role="status"` indicator; when they diverge it SHALL render a prominent `role="alert"` warning that the managed competition is not live and visitors still see the active one, with a quick action to switch managed to the live competition.

#### Scenario: Diverged context warns

- **WHEN** the managed competition differs from the active competition
- **THEN** an alert-styled banner stating that edits are not visible to visitors is shown on every admin page, including `/admin/matches`

#### Scenario: Coinciding context is calm

- **WHEN** the managed competition equals the active competition
- **THEN** a single non-alarming status line indicating you are managing the live competition is shown
