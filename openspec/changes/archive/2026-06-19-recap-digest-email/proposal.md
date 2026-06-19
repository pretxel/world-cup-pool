## Why

The app already auto-generates a dramatic AI recap and a 4-panel comic image for every final match (`lib/matches/match-summary.ts` → `match_summaries` + an async Leonardo render landing in `match_summary_images` with `status='complete'`), and surfaces the latest five comics in a landing-page gallery (`components/recent-recap-images.tsx`). But the user is never told this content exists: discovery depends on the player happening to revisit the home page after a matchday. análisis.md flags this as medium bet **M9** — "Email digest de recaps post-jornada (cómic + share links)": brand-new content the user did not know existed, captured at the same-day engagement peak.

The render is asynchronous (the comic moves to `complete` via the Leonardo webhook/poll, after the match goes final), so there is no single synchronous moment to email from. This change adds a small cron + dispatcher + a per-image sent-log so that, once a matchday's comics have rendered, each player gets one digest email of the new comics with a link to each match detail and a recap share link. It reuses the existing email pattern (`lib/notifications/result-emails.ts`: admin client, Resend batch send, ledger-as-idempotency, `env.emailFrom`) and honors the existing per-player `profiles.email_prefs`.

## What Changes

- Add a new per-image sent-log table `recap_digest_email_log (summary_image_id, user_id, sent_at)` (Supabase migration) giving at-most-once delivery of each completed recap comic to each player, with a backfill that pre-marks all already-`complete` images so shipping never blasts historical recaps.
- Add a new email preference key `recap_digest` to `lib/email-prefs.ts` (`EMAIL_PREF_KEYS`, `DEFAULT_EMAIL_PREFS`, `emailPrefsSchema`, `normalizeEmailPrefs`), default opted-IN, so the digest is suppressible via the existing in-app toggles and footer unsubscribe.
- Add a pure, dependency-free renderer `lib/notifications/recap-digest-template.ts` (modeled on `result-email-template.ts`: email-safe table HTML, fixed hex palette, HTML + plain-text parts, all copy passed in) that lists the new recap comics as thumbnails, each linking to its match detail and carrying a recap share link.
- Add a server-only dispatcher `lib/notifications/recap-digest-emails.ts` (`dispatchRecapDigest`) that finds `match_summary_images` rows with `status='complete'` not yet in the sent-log, resolves their comic public URL + match teams, batches one digest per eligible player (recipients = active leaderboard players), drops `recap_digest` opt-outs, sends via Resend, and stamps the sent-log only for accepted batches.
- Add a new cron route `app/api/cron/recap-digest/route.ts` (Bearer `CRON_SECRET`, `recordRun` wrapped, isolated) plus a `vercel.json` cron entry, so completed comics are picked up shortly after they render.
- Add a `recapDigest` i18n namespace to `messages/{en,es,fr,de}.json`.
- No-op silently when `RESEND_API_KEY` is unset (mirrors the existing dispatchers).

Non-goals: building a new shareable recap OG card (`/api/og/recap`, a separate análisis.md item), changing recap/comic generation, adding push notifications, per-timezone scheduling, or batching configuration beyond the existing 100-per-batch Resend cap.

## Capabilities

### New Capabilities
- `recap-digest-email`: email each player a post-matchday digest of newly-rendered recap comics, with a link to each match and a recap share link, idempotent via a per-image sent-log and gated on the player's `recap_digest` email preference.

### Modified Capabilities

## Impact

- **App**: new `app/api/cron/recap-digest/route.ts` (cron entry point, `maxDuration = 60`, `recordRun("recap_digest", "cron", ...)`, isolated like `app/api/cron/prediction-reminders/route.ts`). New `vercel.json` cron entry.
- **Lib**: new `lib/notifications/recap-digest-template.ts` (pure renderer) and `lib/notifications/recap-digest-emails.ts` (server-only dispatcher). Reuses `lib/env` (`emailFrom`/`resendApiKey`/`siteUrl`/`supabaseUrl`), `lib/supabase/admin`, `lib/i18n` (`DEFAULT_LOCALE`/`localePath`), `getTranslations`, the `isOptedIn` reader from `lib/email-prefs.ts`, and `isSendableEmail`/`resolveEmail`/`warnIfSenderMisconfigured` patterns from `result-emails.ts`. Extends `lib/email-prefs.ts` with the `recap_digest` key.
- **Data**: one new table `public.recap_digest_email_log` (Supabase migration, RLS-enabled with no policies — service-role-only, mirroring `result_email_log`) plus a backfill marking existing `complete` images. The comic public URL is derived from the `match-recap-images` bucket exactly as in `components/recent-recap-images.tsx`.
- **i18n**: new `recapDigest` namespace in `messages/{en,es,fr,de}.json`.
- **Dependency / caveat**: deliverability depends on `EMAIL_FROM` being a Resend verified-domain sender in production (already configured: `EMAIL_FROM=no-reply@edselserrano.com`, domain verified). With `RESEND_API_KEY` unset the dispatch no-ops. The comic image URL must be a public Supabase object URL (the `match-recap-images` bucket is public) so it renders in mail clients.
