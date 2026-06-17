## ADDED Requirements

### Requirement: Render state storage

The system SHALL track an image render per recap version in a `match_summary_images`
table, one row per recap version (`summary_id` unique, foreign key to
`match_summaries` with cascade delete). A row SHALL record the Leonardo `generation_id`
(unique, used to correlate the async result), a `status` (`pending`, `complete`, or
`failed`), the `storage_path` of the stored image when complete, and an `error` when
failed. The generated image bytes SHALL live in a public-read Supabase Storage bucket
`match-recap-images`; writes SHALL occur only via the service role.

#### Scenario: Render request recorded as pending

- **WHEN** a render is requested for a recap version
- **THEN** a `match_summary_images` row exists for that version with `status` `pending`
  and the Leonardo `generation_id` stored

#### Scenario: Completed render is publicly readable

- **WHEN** a render completes and its image is stored
- **THEN** the row's `status` is `complete`, `storage_path` points to the object in
  `match-recap-images`, and the object is readable via its public URL

### Requirement: Leonardo render request

The system SHALL request a render by POSTing the recap version's `image_prompt` to the
Leonardo.ai generations endpoint with `model` `gpt-image-2`, a single image, and the
template's 2:3 portrait dimensions (both multiples of 16, within Leonardo's pixel
limits), authenticated with the Leonardo API key. The request SHALL be skipped when the
recap version has no `image_prompt`.

#### Scenario: Prompt sent to Leonardo

- **WHEN** a render is requested for a version whose `image_prompt` is set and the
  Leonardo API key is configured
- **THEN** the system POSTs that prompt to Leonardo with `model: "gpt-image-2"` and
  records the returned generation id

#### Scenario: No prompt to render

- **WHEN** a render is requested for a version whose `image_prompt` is null
- **THEN** no Leonardo request is made and the caller is told there was nothing to
  render

### Requirement: Authenticated render webhook

The system SHALL expose `POST /api/callback-image` to receive Leonardo's
`image_generation.complete` callback. The request SHALL be authenticated by an
`authorization: Bearer <LEONARDO_WEBHOOK_SECRET>` header; a missing or incorrect secret
SHALL be rejected with 401. On a valid callback the system SHALL read the generation id
and image URL(s) from the payload, correlate to the pending render by generation id,
download the image, store it in the bucket, and mark the render `complete`. An unknown
generation id SHALL be acknowledged without error. Processing SHALL be idempotent — a
repeated callback for an already-complete render SHALL not duplicate work.

#### Scenario: Valid completion callback

- **WHEN** Leonardo POSTs a valid `image_generation.complete` with a known generation id
  and a valid bearer secret
- **THEN** the system downloads the image, stores it in `match-recap-images`, and marks
  the matching render `complete`

#### Scenario: Unauthenticated callback rejected

- **WHEN** a request to `/api/callback-image` lacks the correct bearer secret
- **THEN** the system responds 401 and performs no storage write

#### Scenario: Unknown generation id ignored

- **WHEN** a valid callback references a generation id with no matching render row
- **THEN** the system acknowledges with a success status and makes no change

#### Scenario: Duplicate callback is idempotent

- **WHEN** a callback arrives for a render already marked `complete`
- **THEN** the system does not re-download or duplicate the stored image

### Requirement: Poll fallback

The system SHALL provide a poll path that fetches a generation's status from Leonardo
(`GET /generations/{id}`) and finalizes a `pending` render using the same
download-and-store logic as the webhook. This SHALL allow finalizing renders in
environments the webhook cannot reach (e.g. local development).

#### Scenario: Finalize via poll

- **WHEN** the poll path runs for a `pending` render whose Leonardo job is complete
- **THEN** the image is downloaded, stored, and the render marked `complete`, identically
  to the webhook path

### Requirement: Automatic and admin-triggered rendering

After a recap version's `image_prompt` is set for the active version in the auto flow,
the system SHALL request a render, isolated so that a render failure never blocks recap
generation, the image-prompt step, score writes, or the surrounding sync. The admin
match detail page SHALL also provide a per-version action to request a render (or
re-render) on demand, restricted to admins, reporting success or failure.

#### Scenario: Auto render after prompt

- **WHEN** the auto flow sets the `image_prompt` for a new active recap
- **THEN** the system requests a render for that version

#### Scenario: Render failure isolated

- **WHEN** the render request fails (e.g. Leonardo error) in the auto flow
- **THEN** the recap, image prompt, score writes, and sync still succeed and the failure
  is logged rather than propagated

#### Scenario: Admin re-render

- **WHEN** an admin triggers the render action for a version that already has an image
- **THEN** a new render is requested and, on completion, replaces the stored image

### Requirement: Provider-key-dormant behavior

When `LEONARDO_API_KEY` is unset, render requests SHALL be dormant: no network call and
no render row write, reporting that nothing was done. When `LEONARDO_WEBHOOK_SECRET` is
unset, the webhook route SHALL reject all callbacks (no unauthenticated processing).

#### Scenario: No Leonardo key configured

- **WHEN** a render is requested while `LEONARDO_API_KEY` is unset
- **THEN** no Leonardo request or render row write occurs and the caller is told the
  render was skipped

#### Scenario: No webhook secret configured

- **WHEN** a callback arrives while `LEONARDO_WEBHOOK_SECRET` is unset
- **THEN** the request is rejected and no storage write occurs
