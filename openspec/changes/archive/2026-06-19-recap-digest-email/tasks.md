## 1. Data: per-image sent-log

- [x] 1.1 Add a Supabase migration under `supabase/migrations/` with a timestamped filename (e.g. `20260619<HHMMSS>_recap_digest_email_log.sql`) creating `public.recap_digest_email_log (summary_image_id uuid not null references public.match_summary_images(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, sent_at timestamptz not null default now(), primary key (summary_image_id, user_id))`.
- [x] 1.2 Add an index on `user_id` and enable RLS with no policies (service-role-only), mirroring `result_email_log`; document the posture in a migration comment.
- [x] 1.3 Backfill: insert a sent-log row for every existing `match_summary_images` row with `status = 'complete'` (against the current active recipient set) with `on conflict do nothing`, so the first cron run finds nothing pending for historical images.

## 2. Email preference key

- [x] 2.1 Add `recap_digest` to `EMAIL_PREF_KEYS`, `DEFAULT_EMAIL_PREFS` (default `true`), `emailPrefsSchema`, and `normalizeEmailPrefs` in `lib/email-prefs.ts`.
- [x] 2.2 Confirm the account-menu toggles and footer unsubscribe routes pick up the new key automatically (they iterate `EMAIL_PREF_KEYS`); add the toggle label copy where those surfaces read it.

## 3. Renderer: recap-digest-template.ts

- [x] 3.1 Create `lib/notifications/recap-digest-template.ts` as a pure, dependency-free renderer modeled on `result-email-template.ts` (fixed hex palette, table layout, inline styles, no `oklch`/`var()`/stylesheets).
- [x] 3.2 Define `RecapDigestStrings` (subject, preheader, eyebrow, heading, headingNoName, intro, perMatchVs label, matchCtaLabel, shareCtaLabel, footer) and `RecapDigestData` (displayName, an array of `{ home, away, comicUrl, matchUrl, shareUrl }`, strings).
- [x] 3.3 Render a brand header, a personalized intro, then one block per comic: thumbnail `<img>` (public bucket URL, team-naming alt text), the teams, a match-detail link, and a recap share link; plus a footer.
- [x] 3.4 Emit both `html` and `text` parts and return `{ subject, html, text }`; HTML-escape all interpolated copy. Ensure the text part lists each match + match link so the email is useful with images blocked.

## 4. Dispatcher: recap-digest-emails.ts

- [x] 4.1 Create `lib/notifications/recap-digest-emails.ts` (`server-only`) exporting `dispatchRecapDigest(fromName?: string)` following the `result-emails.ts` pattern (admin client, `DispatchSummary` shape, `warnIfSenderMisconfigured`/`senderMisconfigured`).
- [x] 4.2 No-op (log + zero summary) when `env.resendApiKey` is unset.
- [x] 4.3 Load `complete` `match_summary_images` (id, summary_id, match_id, storage_path); join `matches` for `home_team`/`away_team`; build comic public URLs from the `match-recap-images` bucket exactly as `components/recent-recap-images.tsx`.
- [x] 4.4 Enumerate recipients from `v_leaderboard_overall` (admin-excluding, like the standings query in `result-emails.ts`); compute pending `(summary_image_id, user_id)` pairs by diffing against `recap_digest_email_log`; group by user (a pure, unit-tested helper mirroring `computePendingByUser`).
- [x] 4.5 Load `profiles.email_prefs` for affected users and drop recipients where `isOptedIn(prefs, "recap_digest")` is false (pure, unit-tested helper mirroring `filterResultOptIns`).
- [x] 4.6 Build localized copy via `getTranslations({ locale: DEFAULT_LOCALE, namespace: "recapDigest" })`; build match links from `env.siteUrl` + `localePath(DEFAULT_LOCALE, "/matches/{id}")` and recap share links from the existing share helper/destination.
- [x] 4.7 Resolve each recipient email via admin `getUserById`, skip when missing or failing `isSendableEmail` (reuse/share the guards from `result-emails.ts`); render per recipient.
- [x] 4.8 Send via `resend.batch.send` in chunks of ≤100; on a successful batch upsert the `recap_digest_email_log` pairs (`onConflict: "summary_image_id,user_id", ignoreDuplicates: true`); on a failed batch leave them pending and count as failed.

## 5. Cron route + schedule

- [x] 5.1 Create `app/api/cron/recap-digest/route.ts` (`maxDuration = 60`) with Bearer `CRON_SECRET` auth, `204` skip in prod when unset, `recordRun("recap_digest", "cron", ...)` wrapping `dispatchRecapDigest(emailFromName)` (from `getActiveBranding`), and isolated zero-summary `200` on failure — mirroring `app/api/cron/prediction-reminders/route.ts`.
- [x] 5.2 Add a `vercel.json` cron entry for `/api/cron/recap-digest` (cadence a few times daily, denser during the tournament) so completed comics are picked up shortly after they render.

## 6. i18n

- [x] 6.1 Add a `recapDigest` namespace to `messages/en.json` with all `RecapDigestStrings` keys.
- [x] 6.2 Mirror the namespace in `messages/es.json`, `messages/fr.json`, and `messages/de.json` with translated copy.
- [x] 6.3 Add the account-menu/footer toggle label for the new `recap_digest` preference in all four locale files.

## 7. Verification

- [x] 7.1 Run typecheck (`tsc --noEmit` / project typecheck script) — no errors.
- [x] 7.2 Run lint — no new violations.
- [x] 7.3 Add/run unit tests: the pure renderer (HTML + text contain each comic's match link and share link; name vs. no-name heading); the pending-pairs grouping helper; the opt-out filter (drops `recap_digest:false`, keeps default/null/non-boolean); the dispatcher no-op when `RESEND_API_KEY` unset.
- [x] 7.4 Manual check: with `RESEND_API_KEY` set and a verified-domain `EMAIL_FROM`, finalize a match so a comic renders to `complete`, run the cron route with the Bearer secret, and confirm one digest arrives with the comic thumbnail, a working match link, and a share link; re-run and confirm no duplicate is sent.
- [x] 7.5 Confirm an opted-out player (`email_prefs.recap_digest = false`) receives no digest, and that the migration backfill prevented any historical-recap blast on first run.
