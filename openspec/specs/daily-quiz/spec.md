# daily-quiz Specification

## Purpose
TBD - created by archiving change add-daily-quiz. Update Purpose after archive.
## Requirements
### Requirement: One active question per day

The system SHALL expose at most one active quiz question per UTC calendar day, identified by an `active_on` date that is unique across questions. The `/quiz` page SHALL show the question whose `active_on` equals the current UTC date, and SHALL render a friendly empty state when none exists for today.

#### Scenario: Today's question is shown
- **WHEN** a question exists with `active_on` equal to the current UTC date
- **THEN** the `/quiz` page renders that question's prompt and options

#### Scenario: No question today
- **WHEN** no question has `active_on` equal to the current UTC date
- **THEN** the page renders a "no question today" empty state instead of an error

### Requirement: The correct answer is never sent before answering

The system SHALL NOT transmit a question's correct option to a client that has not yet answered it. Public reads of questions SHALL come from a view that omits the correct-answer column, and the correct option SHALL be disclosed only as the result of submitting an answer.

#### Scenario: Unanswered question hides the answer
- **WHEN** a signed-in or anonymous client loads today's question before answering
- **THEN** the response contains the prompt and options but not the correct option index

#### Scenario: Direct table read is blocked
- **WHEN** a non-admin client selects directly from the questions base table
- **THEN** RLS denies the read (only the answer-omitting public view is granted)

### Requirement: One-shot answering with server-side grading

The system SHALL let a signed-in user answer the active question exactly once. Grading SHALL happen server-side; the server SHALL compute correctness, persist the answer, and return whether it was correct along with the correct option. A second answer to the same question SHALL be rejected.

#### Scenario: First answer is graded
- **WHEN** a signed-in user submits a choice for today's question
- **THEN** the system stores the answer, computes correctness server-side, and returns `{ is_correct, correct_index }`

#### Scenario: Second answer rejected
- **WHEN** a user who already answered today's question submits again
- **THEN** the system rejects the submission and does not overwrite the original answer

#### Scenario: Anonymous cannot answer
- **WHEN** a signed-out visitor attempts to submit an answer
- **THEN** the submission is rejected and nothing is stored

### Requirement: Points and personal streak

The system SHALL award points for correct answers and SHALL show the signed-in user their current streak — the number of consecutive UTC days, ending today or yesterday, on which they answered a question.

#### Scenario: Correct answer earns points
- **WHEN** a user answers correctly
- **THEN** their quiz point total increases

#### Scenario: Streak reflects consecutive days
- **WHEN** a user has answered on each of the last N consecutive UTC days (ending today or yesterday)
- **THEN** the `/quiz` page shows a streak of N

#### Scenario: Missed day breaks the streak
- **WHEN** a user did not answer on a day between two answered days
- **THEN** the streak counts only the most recent unbroken run

### Requirement: Separate quiz leaderboard

The system SHALL provide a quiz leaderboard ranking players by total quiz points, then by earliest first answer. It SHALL be distinct from the prediction-pool leaderboard, which SHALL be unaffected.

#### Scenario: Ranking order
- **WHEN** the quiz leaderboard is viewed
- **THEN** players are ordered by total quiz points descending, ties broken by earliest first answer

#### Scenario: Pool leaderboard unchanged
- **WHEN** a user earns quiz points
- **THEN** their position on the prediction-pool leaderboard does not change

### Requirement: Admin question authoring

The system SHALL let an admin create a quiz question with a prompt, options, the correct option, and an `active_on` date. Non-admins SHALL NOT be able to create or edit questions.

#### Scenario: Admin creates a question
- **WHEN** an admin submits a prompt, options, correct option, and an `active_on` date
- **THEN** the question is stored and becomes the active question on that date

#### Scenario: Non-admin blocked
- **WHEN** a non-admin attempts to create or edit a question
- **THEN** the operation is denied by RLS

