## Purpose

Email each player a post-matchday digest of newly-rendered recap comics (the 4-panel AI comic produced for every final match, landing asynchronously in `match_summary_images` with `status='complete'`), with a thumbnail, a link to each match detail page, and a recap share link. This surfaces brand-new content the player did not know existed at the same-day engagement peak (análisis.md bet M9), built on the existing cron + renderer + dispatcher + Resend + i18n + recordRun patterns with no new third-party dependency. Delivery is idempotent via a per-image sent-log and gated on the player's `recap_digest` email preference.

## Requirements

### Requirement: Post-matchday recap digest dispatch

The system SHALL provide a server-only dispatcher (`dispatchRecapDigest` in `lib/notifications/recap-digest-emails.ts`) that emails each eligible player a digest of newly-rendered recap comics. A recap comic is "new" for a player when its `match_summary_images` row has `status = 'complete'` and there is no `recap_digest_email_log` row for that `(summary_image_id, user_id)` pair. The dispatcher SHALL group all of a player's new comics into a single email, and SHALL send through Resend (`resend.batch.send`, ≤100 messages per batch) using `env.emailFrom`. The dispatcher SHALL no-op (log and return a zero summary) when `env.resendApiKey` is unset.

#### Scenario: New comics are emailed once per player

- **WHEN** a matchday's recap comics have rendered to `status = 'complete'` and have no sent-log rows for an eligible player
- **THEN** that player receives one digest email listing those comics
- **AND** a `recap_digest_email_log` row is written for each included `(summary_image_id, user_id)` pair only after Resend accepts the batch

#### Scenario: Already-sent comics are not resent

- **WHEN** the dispatcher runs again after a successful send
- **THEN** comics already recorded in `recap_digest_email_log` for a player are not included again
- **AND** no email is sent to a player whose new-comic set is empty

#### Scenario: Resend not configured

- **WHEN** `env.resendApiKey` is unset
- **THEN** the dispatcher logs that it is skipping and returns a zero summary without resolving recipients or sending

#### Scenario: Pending images are skipped

- **WHEN** a recap image row exists with `status` of `pending` or `failed`
- **THEN** it is not included in any digest until it reaches `status = 'complete'`

### Requirement: Idempotent per-image sent-log

The system SHALL persist delivery in a new table `public.recap_digest_email_log` keyed by `(summary_image_id, user_id)` (`summary_image_id` referencing `public.match_summary_images(id)` with `on delete cascade`), with a `sent_at timestamptz` default `now()`. A row SHALL be written only after the email provider accepts the batch containing that comic for that user, so a failed batch leaves those pairs pending and they retry on the next run. The table SHALL have RLS enabled with no policies (service-role access only), mirroring `public.result_email_log`. The migration SHALL backfill a sent-log row for every existing `complete` image so shipping the feature does not email historical recaps.

#### Scenario: At-most-once across re-runs and crashes

- **WHEN** the dispatcher is re-run after a batch was accepted but the process crashed before the next batch
- **THEN** comics whose pairs were already logged are not resent
- **AND** comics whose pairs were not logged are still pending and get sent

#### Scenario: Failed batch leaves pairs pending

- **WHEN** Resend rejects or errors on a batch
- **THEN** no `recap_digest_email_log` rows are written for that batch
- **AND** those `(summary_image_id, user_id)` pairs are retried on the next run

#### Scenario: Historical recaps are not blasted on deploy

- **WHEN** the migration runs against a database that already has `complete` recap images
- **THEN** a sent-log row is recorded for each such image so the first cron run finds nothing pending for those images

### Requirement: Digest content lists each new comic with links

The digest email SHALL list each new recap comic as a thumbnail image whose source is the comic's public Supabase URL (built from the `match-recap-images` public bucket and the image's `storage_path`, exactly as in `components/recent-recap-images.tsx`), with `alt` text naming the two teams. Each listed comic SHALL include a link to its match detail page (`localePath(DEFAULT_LOCALE, "/matches/{matchId}")`, prefixed by `env.siteUrl`) and a recap share link. The email SHALL be produced by a pure, dependency-free renderer (`lib/notifications/recap-digest-template.ts`) that emits both an HTML part (email-safe table layout, inline styles, fixed hex palette, no `oklch`/`var()`/stylesheets) and a plain-text part, mirroring `result-email-template.ts`. All user-facing copy SHALL be supplied by the caller and resolved from a `recapDigest` i18n namespace present in `messages/{en,es,fr,de}.json`; the renderer SHALL HTML-escape interpolated values.

#### Scenario: Each comic links to match and share

- **WHEN** the digest is rendered for a player with two new comics
- **THEN** the HTML and text parts include both comics, each with its match-detail link and its recap share link
- **AND** each comic image uses the public bucket URL and has team-naming alt text

#### Scenario: Useful with images disabled

- **WHEN** a mail client blocks remote images
- **THEN** the email still presents each match's teams and its match-detail link in text so the digest remains actionable

### Requirement: Honor the recap-digest email preference

The system SHALL add a new email preference key `recap_digest` to `lib/email-prefs.ts` (`EMAIL_PREF_KEYS`, `DEFAULT_EMAIL_PREFS`, `emailPrefsSchema`, `normalizeEmailPrefs`), defaulting to opted-IN. The dispatcher SHALL drop any recipient whose `profiles.email_prefs.recap_digest` is explicitly `false`, using the existing `isOptedIn` reader; a recipient with no stored preference, a null column, or a non-boolean value SHALL be treated as opted-in. The existing in-app account-menu toggles and footer unsubscribe surfaces (which iterate `EMAIL_PREF_KEYS`) SHALL therefore expose and control this preference without further wiring.

#### Scenario: Opted-out player receives no digest

- **WHEN** a player's `email_prefs.recap_digest` is `false`
- **THEN** that player is excluded from the dispatch and receives no digest email

#### Scenario: Default and malformed preferences opt in

- **WHEN** a player has no `recap_digest` key, a null `email_prefs`, or a non-boolean value
- **THEN** that player is treated as opted-in and is eligible for the digest

### Requirement: Scheduled, isolated cron entry point

The system SHALL expose the dispatch via a new cron route `app/api/cron/recap-digest/route.ts` scheduled in `vercel.json`. The route SHALL require `Authorization: Bearer ${CRON_SECRET}` when `CRON_SECRET` is set (and skip with `204` in production when it is unset), wrap the dispatch in `recordRun("recap_digest", "cron", ...)`, and isolate any dispatch failure into a logged zero-summary `200` response rather than a `500`, mirroring `app/api/cron/prediction-reminders/route.ts`. The summary SHALL flag `senderMisconfigured` when the production email-sender guard detects a misconfiguration, matching the result-email dispatch.

#### Scenario: Authorized cron run

- **WHEN** the cron route is called with a valid `Bearer ${CRON_SECRET}`
- **THEN** the dispatch runs, the run is recorded via `recordRun`, and a summary is returned

#### Scenario: Unauthorized call is rejected

- **WHEN** `CRON_SECRET` is set and the request lacks a matching Bearer token
- **THEN** the route responds `401` and does not dispatch

#### Scenario: Dispatch failure is isolated

- **WHEN** the dispatch throws during a cron run
- **THEN** the error is caught and logged
- **AND** the route returns a `200` with a zero summary instead of a `500`
