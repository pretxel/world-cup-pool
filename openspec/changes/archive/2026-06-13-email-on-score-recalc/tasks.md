## 1. Dependencies & Environment

- [x] 1.1 Add `resend` to `package.json` dependencies and install
- [x] 1.2 Add `resendApiKey` (`RESEND_API_KEY ?? null`) and `emailFrom` (`EMAIL_FROM ?? "World Cup Pools <onboarding@resend.dev>"`) to `lib/env.ts`, nullable/gated like the other cron vars
- [x] 1.3 Document `RESEND_API_KEY` and `EMAIL_FROM` in `.env.example` (or equivalent) and note the verified-domain requirement for production

## 2. Database — ledger + backfill

- [x] 2.1 Write migration `supabase/migrations/*_result_email_log.sql`: create `result_email_log(match_id uuid, user_id uuid, sent_at timestamptz default now())` with a unique `(match_id, user_id)` constraint and FKs to `matches`/`auth.users`
- [x] 2.2 Add RLS enabling service-role-only access (no client reads/writes)
- [x] 2.3 In the same migration, backfill: `INSERT INTO result_email_log (match_id, user_id) SELECT DISTINCT s.match_id, s.user_id FROM scores s JOIN matches m ON m.id = s.match_id WHERE m.status = 'final' ON CONFLICT DO NOTHING`
- [x] 2.4 Apply the migration and regenerate `lib/database.types.ts` — applied to production (`pabzhdozyoepvjeqxega`); 53 ledger rows backfilled = 53 scored finals; RLS on, 0 policies; generated types match the hand-added block exactly

## 3. Email template renderer (pure)

- [x] 3.1 Create `lib/notifications/result-email-template.ts` exporting `renderResultEmail(data) → { subject, html, text }` (pure, no DB/network)
- [x] 3.2 Define the recipient payload type: display name, current standing (rank, total points, exact hits, winner/GD hits), and a list of finished matches (home/away team, home/away score, the recipient's `points` + `hit_type`)
- [x] 3.3 Build the HTML with table layout + inline hex styles using the design's token→hex map (pitch green header, cream body, gold/ink/green rank tones, outcome chip, mono uppercase labels); include logotype/header band mirroring the web
- [x] 3.4 Build the plain-text part mirroring the HTML content
- [x] 3.5 Add the `email` namespace strings to `messages/en.json`, `messages/es.json`, `messages/fr.json` (subject, header, "you earned", outcome labels, standing labels); resolve copy via the default locale through a single locale resolver

## 4. Dispatch logic

- [x] 4.1 Create `lib/notifications/result-emails.ts` with `dispatchResultEmails()` returning a summary (`{ emailed, failed, skipped }`)
- [x] 4.2 No-op (log + zero summary) when `env.resendApiKey` is null
- [x] 4.3 Query pending recipients: `(match_id, user_id)` from `scores` joined to `matches` where `status = 'final'` and no `result_email_log` row exists
- [x] 4.4 Resolve each recipient's email from `auth.users` via the admin client, current standing from `v_leaderboard_overall`, display name from `profiles`, and group the finalized matches per user (one email per user covering all their matches)
- [x] 4.5 Render each email and send via `resend.batch.send`, chunked to ≤100 messages per call
- [x] 4.6 Write `result_email_log` rows only for messages Resend accepted; leave failures pending; log + count per-recipient errors without aborting the batch

## 5. Cron wiring

- [x] 5.1 In `app/api/cron/sync-matches/route.ts`, after `runSync()` (only on the non-204 path), call `dispatchResultEmails()` inside try/catch so any throw is caught and logged
- [x] 5.2 Merge an `emailed` count into the route's JSON summary for observability

## 6. Tests

- [x] 6.1 Unit-test `renderResultEmail`: subject/html/text shape, exact-vs-winner/GD-vs-miss outcome chips, multi-match single email, snapshot values, and that output contains no oklch/CSS-variable styling
- [x] 6.2 Test recipient resolution: only scored users of final matches are pending; already-logged pairs are skipped; non-final matches yield none
- [x] 6.3 Test dispatch gating: null `RESEND_API_KEY` no-ops without throwing; ledger rows written only on accepted sends; failed sends remain pending
- [x] 6.4 Test cron isolation: a dispatch error is caught and the route still returns the sync summary with a 2xx status
- [x] 6.5 Run `npm run lint`, `npm run typecheck`, and `npm run test` — all green
