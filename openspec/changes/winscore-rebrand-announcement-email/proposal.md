## Why

The product is rebranding from "WC 26 POOL" to **WinScore** (winscore.me) and has shipped
major new capabilities — multi-league support, crypto payments, and more. Existing players
still see the old wordmark and don't know about the new features. We need a one-off
announcement email that introduces the WinScore brand and drives players back to try the new
capabilities, dispatched to the whole player base from the admin operations control room.

## What Changes

- Add a new **WinScore announcement** email template: rebrand header/wordmark, a "what's new"
  feature list (multi-league, crypto payments, and more), and a CTA to winscore.me.
- Add a **manual broadcast dispatch** that sends the announcement to **all players** (not a
  subset), honoring per-player email opt-out and an at-most-once send ledger so re-runs never
  double-send.
- Register a new `announcement_email` operation kind so the admin **Operations → Overview**
  shows a "Run now" card with the run summary (recipients / emailed / failed / skipped),
  exactly like the winners-email job.
- Add the template to the admin **email preview** registry so the announcement can be reviewed
  before it goes out.
- Localize the announcement copy (same `en` / `es` posture as the other transactional emails).

## Capabilities

### New Capabilities
- `announcement-email`: A one-off, admin-triggered broadcast that announces the WinScore
  rebrand and new features to every eligible player, with opt-out honoring and at-most-once
  delivery via a send ledger.

### Modified Capabilities
- `admin-operations-monitoring`: The operations control room gains the `announcement_email`
  job — a manual-only "Run now" card with its run recorded and summarized alongside existing
  jobs.
- `admin-email-preview`: The email preview registry gains the `announcement` template so an
  admin can render it before broadcasting.

## Impact

- **New code**: `lib/notifications/announcement-email-template.ts` (pure renderer),
  `lib/notifications/announcement-emails.ts` (dispatch), a new `announcement_email_log`
  migration, and a new `announcementEmail` i18n namespace (`en` + `es`).
- **Modified code**: `lib/operations/record-run.ts` (new `OperationKind`),
  `app/[locale]/(admin)/admin/operations/actions.ts` and `overview.tsx` (new run action),
  `lib/notifications/email-previews.ts` + `preview-fixtures.ts` (new preview),
  `operation_runs` CHECK constraint (new kind value).
- **No breaking changes**: purely additive. The ledger + opt-out reuse the established
  winners-email posture (service-role-only table, RLS-on/no-policies).
- **Dependencies**: none new — reuses Resend batch send, the admin Supabase client, and
  next-intl.
