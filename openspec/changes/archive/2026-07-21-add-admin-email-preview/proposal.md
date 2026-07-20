# Proposal: add-admin-email-preview

## Why

The app sends ~11 transactional email types (welcome, result, digests, reminders, comeback, playoff score, score rules, group invite, magic link), but the only way to see what any of them looks like is to trigger a real send to a real inbox. Admins cannot verify copy, layout, or locale variants before emails go out, which makes template and translation changes risky and slow to review.

## What Changes

- Add an email preview capability to the admin Operations area (`/admin/operations`), alongside the existing Emails send-log view.
- Admin picks an email template and a locale; the server renders the real template function (`render*Email`) with representative sample data and the real localized strings, and the page shows:
  - the rendered subject and preheader,
  - the HTML body in a sandboxed iframe,
  - a toggle to the plain-text version.
- Previews are render-only: no email is ever sent, no send guards or logs are touched.
- Sample fixture data is defined per template so previews are deterministic and need no database state.

## Capabilities

### New Capabilities

- `admin-email-preview`: Admin-only preview of every transactional email template, rendered with sample data in any supported locale, showing subject, preheader, HTML, and plain-text output without sending anything.

### Modified Capabilities

<!-- none — the existing admin-operations-monitoring requirements (run ledger, overview, send logs) are unchanged; preview is additive -->

## Impact

- **UI**: new preview view under `app/[locale]/(admin)/admin/operations/` (new tab or sub-view next to the existing Emails logs view); small client component for template/locale selection and HTML/text toggle.
- **Server**: read-only use of existing pure template renderers in `lib/notifications/*-template.ts` and their `build*Strings` helpers with `getTranslations`; new sample-data module for fixtures.
- **i18n**: new `admin.operations` keys for the preview UI in `messages/{en,es,de,fr}.json` (email copy itself already localized).
- **No changes** to send paths, Resend integration, cron jobs, or database schema.
