# pool-winners-email Specification

## Purpose

Congratulate the pool's final podium (overall leaderboard rank ≤ 3, ties included) with a one-off, localized email — dispatched manually by the admin from the Operations overview once standings are settled, delivered at most once per player.

## Requirements

### Requirement: Podium players receive a congratulation email

The system SHALL send a congratulation email to every player whose final rank on the overall leaderboard is 3 or better, ties included. The email SHALL show the recipient's final rank and total points, the full podium standings with the recipient's row marked, and a link to the leaderboard. The footer SHALL include a maker credit ("Made with love :) — pretxel") and a teaser announcing the upcoming "La Liga Pool", in both the HTML and plain-text bodies.

#### Scenario: Winner receives their congratulation

- **WHEN** the winners email is dispatched and a player finished with rank 2
- **THEN** that player receives an email stating they finished #2 with their point total, showing the podium table with their row marked

#### Scenario: Tied podium places are all included

- **WHEN** two players share rank 3 at dispatch time
- **THEN** both receive the congratulation email

#### Scenario: Non-podium players receive nothing

- **WHEN** the winners email is dispatched
- **THEN** no player with rank 4 or worse receives an email

#### Scenario: Footer carries credit and La Liga teaser

- **WHEN** the winners email renders in any locale
- **THEN** the footer contains the "Made with love :) — pretxel" credit and the "La Liga Pool" coming-soon teaser in both HTML and text bodies

### Requirement: Winners email is dispatched manually from the Operations overview

The `winners_email` operation SHALL appear as a manual-only tile on the admin Operations overview with a "Run now" button and no cron schedule. Each run SHALL be recorded in the operations run ledger with a summary of winners found, emails sent, and skips.

#### Scenario: Admin runs the job from the tile

- **WHEN** an admin presses "Run now" on the winners email tile
- **THEN** the dispatch executes under the admin gate, the run is recorded with trigger `manual`, and the overview shows the outcome summary

#### Scenario: Job never fires from cron

- **WHEN** the scheduled cron dispatcher enumerates jobs to run
- **THEN** `winners_email` is never among them and its tile shows "Manual only"

### Requirement: Delivery is at-most-once per recipient

The dispatch SHALL record each accepted send in a `winners_email_log` ledger and SHALL skip any player already present in it. The ledger row SHALL be written only after the email provider accepts the message, so a failed or partial run leaves unsent winners pending for a later run.

#### Scenario: Re-run does not double-send

- **WHEN** the admin runs the winners email a second time after a fully successful run
- **THEN** zero emails are sent and the summary reports all winners already handled

#### Scenario: Partial failure is recoverable

- **WHEN** a run fails after some sends were accepted
- **THEN** a later run sends only to the winners without a ledger row

### Requirement: Winners email respects player preferences and deliverability

The dispatch SHALL skip players who opted out of the `results_digest` email preference and players without a deliverable address, counting them in the run summary as skipped.

#### Scenario: Opted-out winner is skipped

- **WHEN** a podium player has disabled the results digest preference
- **THEN** they receive no winners email and the summary counts the skip

### Requirement: Winners email is localized

The email copy SHALL resolve through a `winnersEmail` message namespace present in all supported locales (`en`, `es`, `fr`, `de`), with the rank phrasing (champion, second, third) selected in the message file rather than in code.

#### Scenario: Copy resolves per locale

- **WHEN** the winners email strings are built for any supported locale
- **THEN** every key resolves from that locale's messages with the recipient's rank, name, and points interpolated
