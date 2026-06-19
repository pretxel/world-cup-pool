# prediction-streak Specification

## Purpose
Give predictions — the app's core loop — a daily habit hook by deriving a current prediction streak (consecutive UTC days within the current week on which the user submitted at least one prediction) from `predictions.submitted_at`, computed on read with no schema change, and surfacing it on `/my-picks` with a flame indicator. This mirrors the existing daily-quiz streak but adds a weekly reset, implementing engagement bet M8 ("streak de predicciones diarias, reset semanal").

## Requirements

### Requirement: Prediction streak computed from submission timestamps

The system SHALL provide a pure function that, given a list of prediction `submitted_at` ISO timestamps and a reference instant `now`, returns the user's current prediction streak: the number of consecutive UTC days, ending on `now`'s UTC day or the day before it, on which the user submitted at least one prediction. The function MUST NOT read the database, import any framework or Supabase module, and MUST accept an injectable `now` so it is unit-testable. Multiple submissions on the same UTC day MUST count as one day, and timestamps in any timezone offset MUST be normalized to their UTC calendar day before counting.

#### Scenario: No predictions
- **WHEN** the function is called with an empty list of timestamps
- **THEN** it returns 0

#### Scenario: Consecutive days ending today
- **WHEN** the user submitted at least one pick on each of today, yesterday, and the day before (all within the current week)
- **THEN** the function returns 3

#### Scenario: Today not yet predicted keeps the streak alive
- **WHEN** the user has not submitted today but submitted yesterday and the day before (both within the current week)
- **THEN** the function returns 2

#### Scenario: Missed in-between day breaks the streak
- **WHEN** the user submitted today and three days ago but not the two days between
- **THEN** the function returns 1 (only the most recent unbroken run from today)

#### Scenario: Multiple picks on one day count once
- **WHEN** the user submitted two picks today and one pick yesterday
- **THEN** the function returns 2

#### Scenario: Non-UTC offsets normalize to the UTC day
- **WHEN** a timestamp with a non-UTC offset falls on the same UTC calendar day as another counted day
- **THEN** that timestamp does not add an extra day to the count

### Requirement: Weekly reset of the prediction streak

The system SHALL count only predictions whose `submitted_at` falls within the current week toward the streak, where the week starts at Monday 00:00:00 UTC and ends at the following Monday 00:00:00 UTC (a half-open interval). Predictions submitted before the current week's Monday MUST NOT contribute to the streak, so the streak resets to at most the number of days elapsed in the current week and can never exceed 7.

#### Scenario: Predictions from last week do not count
- **WHEN** today is Tuesday with a pick today, and the user also has a pick last Saturday and last Sunday (the prior week)
- **THEN** the streak counts only days within the current week (the prior-week picks are excluded)

#### Scenario: Fresh week resets the streak
- **WHEN** it is Monday and the user has not yet submitted any pick this week (their most recent pick was last week)
- **THEN** the function returns 0

#### Scenario: Streak cannot exceed days in the week
- **WHEN** the user has submitted a pick on every UTC day from this week's Monday through today (Sunday)
- **THEN** the streak is at most 7

### Requirement: Prediction streak surfaced on My Picks

The system SHALL display the signed-in user's current prediction streak on the `/my-picks` page header as a stat alongside the existing Picks, Exact, and Points stats, derived from the predictions already loaded for that user (no additional query). The streak SHALL be shown with a flame indicator that is visually active when the streak is greater than 0 and muted when it is 0, and its label and any helper copy SHALL be localized for en, es, fr, and de.

#### Scenario: Active streak shows a lit flame
- **WHEN** a signed-in user whose current prediction streak is greater than 0 views `/my-picks`
- **THEN** the header shows the streak value with an active (colored) flame indicator and a localized label

#### Scenario: Zero streak shows a muted flame
- **WHEN** a signed-in user whose current prediction streak is 0 views `/my-picks`
- **THEN** the header shows 0 with a muted flame indicator, not an error or empty state

#### Scenario: No extra database query
- **WHEN** the `/my-picks` page computes the streak
- **THEN** it uses the `submitted_at` values from the predictions already fetched for the page and issues no additional database request for the streak
