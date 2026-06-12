# admin-fixture-editing — delta for sync-matches-fallback

## ADDED Requirements

### Requirement: Admin can trigger a result sync on demand

The `/admin/matches` page SHALL provide a "Sync now" control that invokes the shared result-sync core directly (server action, no HTTP hop through the cron route) and, on completion, revalidates the matches views and surfaces the run summary (source used, matched, final, stale counts, errors) to the admin. The action SHALL be available only within the existing admin-gated layout.

#### Scenario: Manual sync resolves a missing result
- **WHEN** an admin clicks "Sync now" while a finished match is still non-final locally
- **AND** a result provider returns the final score for that match
- **THEN** the match is updated to `status='final'` with its score and `compute_match_scores` runs for it
- **AND** the admin sees a run summary including the source used

#### Scenario: Manual sync reports failure visibly
- **WHEN** an admin clicks "Sync now" and every provider fails
- **THEN** the admin sees a summary with `source: "none"` and a non-zero error count, rather than a silent success

### Requirement: Admin surfaces stale results

Each match row on `/admin/matches` SHALL display a stale indicator when the match's `kickoff_at` is more than 3 hours past, its status is not terminal (`final`/`cancelled`), and both teams resolve to real countries — the same staleness rule used by the sync core. Non-stale matches SHALL NOT show the indicator.

#### Scenario: Stale badge shown
- **WHEN** an admin views `/admin/matches` and a confirmed match kicked off 4 hours ago without a final result
- **THEN** that row shows a stale indicator

#### Scenario: No badge for finals or upcoming matches
- **WHEN** a match is `status='final'` or its kickoff is in the future
- **THEN** that row does not show the stale indicator
