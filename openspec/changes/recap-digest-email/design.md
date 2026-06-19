## Context

Recaps and comics are produced today by `generateMatchSummary` (`lib/matches/match-summary.ts`), called from the `sync-matches` cron's `generatePendingSummaries` pass after results are written. For each final match with events it stores an active `match_summaries` row, derives a comic-strip image prompt, and requests an async Leonardo render. That render lands later in `public.match_summary_images` as a row that transitions `pending` → `complete` (with `storage_path`) via the webhook/poll. The landing gallery (`components/recent-recap-images.tsx`) reads `match_summary_images where status = 'complete'`, joins `matches` for team names, and builds the comic's public URL from the `match-recap-images` public bucket:

```
${SUPABASE_URL}/storage/v1/object/public/match-recap-images/${storage_path}
```

The email infrastructure is mature and consistent across `result-emails.ts`, `quiz-reminder-emails.ts`, and `prediction-reminder-emails.ts`:
- A **pure renderer** (`result-email-template.ts`) builds email-safe HTML (table layout, inline styles, fixed hex palette, no `oklch`/`var()`/stylesheets) + a plain-text part, with all copy passed in by the caller — fully unit-testable.
- A **server-only dispatcher** gates on `env.resendApiKey`, resolves recipient emails from `auth.users` via the service-role admin client, builds localized copy via `getTranslations({ locale: DEFAULT_LOCALE, namespace })`, derives URLs from `env.siteUrl` + `localePath`, sends via `resend.batch.send` (≤100/batch), and writes a **ledger row only after Resend accepts** the batch — giving at-most-once delivery that survives crashes and idempotent re-runs (`result_email_log`).
- Recipients are filtered against `profiles.email_prefs` (jsonb) via `isOptedIn` (`lib/email-prefs.ts`); every type defaults opted-IN.
- Crons authenticate with Bearer `CRON_SECRET`, wrap work in `recordRun(...)`, and isolate failures into a zero-summary response so a flaky run never trips Vercel's cron alerting (`app/api/cron/prediction-reminders/route.ts`).

The key difference for M9: the unit of "new content" is **a completed comic render** (`match_summary_images.status = 'complete'`), not a final match — and it appears asynchronously after the render finishes, so the digest needs its own cron + its own sent-log keyed by image.

## Goals / Non-Goals

**Goals:**
- After a matchday's comics have rendered, email each eligible player one digest of the **new** recap comics (those not yet sent to them), each with a thumbnail, a link to the match detail, and a recap share link.
- At-most-once delivery of each completed comic per player, surviving crashes and idempotent re-runs.
- Reuse the existing renderer/dispatcher/Resend/`recordRun`/i18n patterns with no new third-party dependency.
- Honor the per-player `recap_digest` email preference (new key, default opted-IN) and the existing opt-out/unsubscribe surfaces.
- Never blast historical recaps on first deploy.

**Non-Goals:**
- A new shareable recap OG card (`/api/og/recap?summaryId=...`) — a separate análisis.md content item; this change links to the existing match detail + existing share path.
- Changing recap text or comic image generation, or the render pipeline.
- Push notifications, per-timezone send windows, or comeback/inactive targeting.
- A per-user "preview" or in-app digest view.

## Decisions

- **Trigger via a dedicated cron, not piggybacking sync-matches.** Comic renders complete asynchronously (Leonardo webhook/poll) minutes-to-hours after a match finalizes, so the sync-matches pass that *requested* the render cannot also email it. A new `app/api/cron/recap-digest/route.ts` (scheduled in `vercel.json`, e.g. a few times a day or hourly during the tournament) scans for `complete` images not yet in the sent-log. This keeps the digest decoupled from result-email timing and naturally batches a whole matchday's renders into one digest per player.
- **Sent-log keyed by `(summary_image_id, user_id)`, not `(match_id, user_id)`.** A match can be re-rendered (the comic row is unique per *summary version*, `match_summary_images_summary_uq`), and the digest's unit is the rendered comic. Keying on `summary_image_id` (FK → `match_summary_images.id`, `on delete cascade`) means a fresh render of the same match is a new digest-able item, and a comic already emailed is never resent. New table `public.recap_digest_email_log (summary_image_id uuid, user_id uuid, sent_at timestamptz default now(), primary key (summary_image_id, user_id))`, RLS enabled with **no policies** (service-role-only, mirroring `result_email_log`). DB migration required.
- **Backfill on deploy.** Insert a sent-log row for every existing `complete` image × every active player at migration time, so the first cron run finds nothing pending and never emails historical recaps. (Mirrors the `result_email_log` backfill.) Practically, marking against the current recipient set is sufficient; new players after deploy only get comics that complete after they join, which is the desired behavior.
- **Recipient set = active leaderboard players.** Reuse `v_leaderboard_overall` (already the standings source in `result-emails.ts` and excludes admins) to enumerate recipients, rather than emailing every `auth.users` row. This bounds the audience to real participants and reuses an existing, admin-excluding view. Each eligible recipient gets the comics they have not yet been sent (typically the full new-matchday set on the first run after a matchday).
- **One digest email per player, listing all their new comics.** Group pending `(image, user)` pairs by user (same shape as `computePendingByUser` in `result-emails.ts`), render one email listing each comic thumbnail + match link + share link, and stamp every included `(summary_image_id, user_id)` pair on success — exactly the result-email ledger discipline.
- **Comic URL + match data.** Build the comic public URL from the `match-recap-images` bucket exactly as `recent-recap-images.tsx` does (`${supabaseUrl}/storage/v1/object/public/match-recap-images/${storage_path}`). Resolve `home_team`/`away_team` by joining `matches`. The match link is `localePath(DEFAULT_LOCALE, "/matches/${matchId}")`; the share link reuses the existing recap/match share destination so no new route is introduced.
- **Email preference.** Add `recap_digest` to `EMAIL_PREF_KEYS`/`DEFAULT_EMAIL_PREFS`/`emailPrefsSchema`/`normalizeEmailPrefs` in `lib/email-prefs.ts` (default `true`), and filter recipients with `isOptedIn(prefs, "recap_digest")` — same drop-the-opted-out pattern as `filterResultOptIns`. The existing account-menu toggles and footer unsubscribe pick the new key up because they iterate `EMAIL_PREF_KEYS`.
- **Localization & sender.** Resolve copy from a new `recapDigest` namespace at `DEFAULT_LOCALE` (consistent with the other dispatchers, which lack a request locale in the cron context). Send from `env.emailFrom` with the active branding from-name (like the other crons via `getActiveBranding`).
- **No-op gating + sender guard.** No-op (log + return zero summary) when `env.resendApiKey` is unset; run `warnIfSenderMisconfigured`-style detection and surface `senderMisconfigured` in the summary, matching `result-emails.ts`.

## Risks / Trade-offs

- **DB migration required.** One new table `recap_digest_email_log` plus a backfill insert. Purely additive, service-role-only, RLS-enabled-no-policies — same posture as `result_email_log`; no change to existing tables. Migration must live under `supabase/migrations/` with a timestamped filename.
- **New cron + `vercel.json` change.** Adds a scheduled function; cost is one short run per schedule tick. Isolated + `recordRun`-wrapped so a failure is a zero summary, never a 500. Cadence is a trade-off: too sparse delays the digest, too frequent risks splitting one matchday's renders across multiple emails — chosen cadence (a few times daily, denser during the tournament) batches a matchday's renders into one digest in practice; the sent-log makes any split harmless (no duplicates).
- **Split-digest edge.** If some of a matchday's comics finish rendering between two cron ticks, a player could receive two digests for one matchday. Acceptable: each comic is sent at most once, and the second digest still surfaces genuinely new content. Cadence is tuned to minimize this.
- **Image rendering in mail clients.** The comic is a remote image from the public Supabase bucket; some clients block remote images by default. Mitigation: meaningful `alt` text (teams), a text part listing match links, and the match link as the primary CTA so the email is useful even with images off.
- **`EMAIL_FROM` / `RESEND_API_KEY` (deliverability).** Prod is already configured (`EMAIL_FROM=no-reply@edselserrano.com`, verified domain); with `RESEND_API_KEY` unset the dispatch no-ops, consistent with existing dispatchers.
- **Locale mismatch.** Sending at `DEFAULT_LOCALE` may not match a user's UI locale — consistent with every existing dispatcher; out of scope to fix here.
- **No Supabase Realtime needed.** This is a cron-driven batch send; no Realtime subscription or live channel is involved.
