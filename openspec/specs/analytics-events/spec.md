# analytics-events

## Purpose

Client-side custom Google Analytics event instrumentation for the key engagement interactions. A single safe `trackEvent` helper emits custom GA events through the gtag global configured in the layout, and is a silent no-op when gtag is unavailable (SSR, no GA id, blocked, or not yet loaded) so it never blocks the interaction it measures. Five events are fired from the real interaction sites — prediction submitted, quiz answered, share clicked, group joined, and leaderboard viewed — to make the viral and retention funnels visible.

## Requirements

### Requirement: Safe client event helper
The system SHALL provide a client-side `trackEvent(name, params?)` helper that emits a custom GA event by calling `window.gtag("event", name, params)`. The helper MUST first verify that it is running in the browser and that `window.gtag` is a function; when either is false it MUST do nothing and MUST NOT throw. The helper MUST NOT be the only path that breaks a user flow — emitting an event MUST never block or fail the interaction it measures. The `window.gtag` global MUST be typed so the helper and its call sites compile under `tsc --noEmit`.

#### Scenario: gtag present
- **WHEN** `trackEvent("prediction_submitted", { match_id })` is called in the browser while `window.gtag` is a function
- **THEN** `window.gtag` is invoked with `("event", "prediction_submitted", { match_id })`

#### Scenario: gtag absent
- **WHEN** `trackEvent` is called during SSR, or in a browser where `window.gtag` is undefined (no GA id, blocked, or not yet loaded)
- **THEN** the helper returns without calling gtag and without throwing
- **AND** the surrounding interaction completes normally

### Requirement: Prediction submitted event
The system SHALL fire a `prediction_submitted` event when a prediction is successfully submitted from the prediction form. The event MUST be fired only on a successful submit (the `result.ok` path), not on validation errors or out-of-range rejections, and MUST include the match identifier as a parameter.

#### Scenario: Successful pick
- **WHEN** a signed-in user submits a valid pick and the server action returns `ok`
- **THEN** `trackEvent("prediction_submitted", { match_id })` is fired alongside the existing success toast

#### Scenario: Rejected pick
- **WHEN** the submit fails validation or the server action returns an error
- **THEN** no `prediction_submitted` event is fired

### Requirement: Quiz answered event
The system SHALL fire a `quiz_answered` event when a quiz answer is accepted by the server. The event MUST be fired only when the answer submission succeeds, MUST include the question identifier, and MUST include whether the answer was correct.

#### Scenario: Answer accepted
- **WHEN** the user picks an option and `submitQuizAnswer` returns `ok`
- **THEN** `trackEvent("quiz_answered", { question_id, correct })` is fired, where `correct` reflects the graded result

#### Scenario: Answer not accepted
- **WHEN** the submission fails (e.g. `already-answered`, `not-signed-in`, `blocked`, or another error)
- **THEN** no `quiz_answered` event is fired

### Requirement: Share clicked event
The system SHALL fire a `share_click` event from the share buttons component for each share affordance (X, Facebook, native share, and copy link). The event MUST include the platform used and MUST include a caller-supplied context that identifies what is being shared (e.g. pick, rank, or quiz), so the component remains reusable across its call sites. Firing the event MUST NOT prevent the share/copy action from proceeding.

#### Scenario: Share on a platform
- **WHEN** the user clicks the X, Facebook, native-share, or copy affordance
- **THEN** `trackEvent("share_click", { platform, context })` is fired with the matching platform value
- **AND** the underlying share or copy action still occurs

#### Scenario: Context passed by caller
- **WHEN** the leaderboard rank-share renders the share buttons with `context="rank"`
- **THEN** the emitted `share_click` events carry `context: "rank"`

### Requirement: Group joined event
The system SHALL fire a `group_joined` event when a user successfully joins a group through the join flow. The event MUST be fired only on a successful join (not when the join action returns an error), and MUST NOT include the raw join code.

#### Scenario: Successful join
- **WHEN** a user submits the join form and the join action succeeds
- **THEN** `trackEvent("group_joined")` is fired

#### Scenario: Failed join
- **WHEN** the join action returns an error (e.g. invalid join code)
- **THEN** no `group_joined` event is fired

### Requirement: Leaderboard viewed event
The system SHALL fire a `leaderboard_viewed` event when the leaderboard page is viewed. Because the leaderboard page is a Server Component, the event MUST be fired from a small client child on mount, and MUST be fired once per page mount.

#### Scenario: Leaderboard mount
- **WHEN** the leaderboard page renders and its client mount child mounts in the browser
- **THEN** `trackEvent("leaderboard_viewed")` is fired exactly once for that mount
