## Context

The app already ships a family of transactional emails built on one repeatable pattern: a
pure `*-template.ts` renderer (email-safe HTML, fixed hex palette, plain-text mirror), a
`server-only` `*-emails.ts` dispatcher that resolves recipients, honors `email_prefs`, sends
via Resend `batch.send`, and stamps a send-once ledger, plus registration in the operations
control room (`OperationKind`, a `JOB` body, a `runX` action, an overview tile) and in the
admin email-preview registry. The most recent addition — the winners congratulation email
(`winners-emails.ts`, `winners_email_log`, `winners_email` operation kind) — is the closest
precedent: a one-off, admin-triggered, manual-only broadcast with at-most-once delivery.

This change reuses that exact pattern for a **rebrand + feature announcement** broadcast. The
single new axis versus winners: it targets **all players**, not a leaderboard subset.

Constraints: production email sender config already resolves (`EMAIL_FROM`, verified domain);
migrations are applied manually against remote (deploys don't run them); the ledger and pref
posture must match the established winners-email security model.

## Goals / Non-Goals

**Goals:**
- A pure, unit-testable announcement renderer carrying the WinScore brand and a "what's new"
  feature list, in `en` + `es`.
- A manual-only broadcast to all players that honors opt-out and is at-most-once via a ledger.
- Surface the job in the operations overview and the email-preview registry with zero drift
  from the winners-email precedent.

**Non-Goals:**
- No cron schedule — this is a deliberate, admin-fired one-off.
- No new email-preference category or account-menu toggle (reuse an existing key).
- No global rebrand of the web app UI, other templates, or the domain — email only.
- No segmentation, scheduling, A/B, or "resend to failures only" beyond what the ledger's
  natural pending-set already gives.

## Decisions

### Reuse the winners-email module shape verbatim
New files `lib/notifications/announcement-email-template.ts` (pure renderer) and
`announcement-emails.ts` (dispatch), structured like their winners counterparts:
`renderAnnouncementEmail(data)`, `buildAnnouncementEmailStrings(t, opts)`,
`dispatchAnnouncementEmail(fromName?)` returning a `DispatchSummary`-shaped summary with a
`recipients` count. **Why:** the pattern is proven, tested, and keeps `email-previews.ts` and
`actions.ts` registration mechanical. *Alternative:* a generic "broadcast any template" engine
— rejected as premature abstraction for a one-off.

### Recipient source: all players from `profiles`, addresses from `auth.users`
Load every `profiles.id` (+ `email_prefs`), resolve each address via the service-role admin
client (`auth.admin.getUserById`), same as winners. **Why:** emails live only in `auth.users`;
`profiles` is the canonical player set and already excludes nothing we need. *Alternative:*
`auth.admin.listUsers` pagination — viable but diverges from the winners resolver; keep one
resolver shape. Batches respect the Resend 100/`batch.send` ceiling via chunking (winners
already chunks; here it actually matters at scale).

### Opt-out category: reuse `recap_digest`
Gate on the existing `recap_digest` preference (the closest "product/news" category) rather
than adding a new `EMAIL_PREF_KEYS` entry. **Why:** avoids new pref plumbing across the schema
default, zod schema, account-menu toggles, and unsubscribe routes for a single broadcast, and
gives players an existing, meaningful unsubscribe. *Alternative A:* reuse `results_digest` like
winners did — rejected, `recap_digest` reads more like "news/updates". *Alternative B:* add an
`announcements` key — more correct long-term but out of scope; noted as an open question.

### At-most-once via a dedicated `announcement_email_log`
New table keyed by `user_id`, RLS enabled, no policies (service-role only), mirroring
`winners_email_log`. Rows written only after Resend accepts a batch. The `operation_runs`
`kind` CHECK constraint is dropped/recreated to add `announcement_email`. **Why:** identical,
audited security posture; the pending-set (all players minus ledger minus opted-out) makes
re-runs naturally resume. *Alternative:* a date-scoped ledger — unnecessary for a one-off.

### Manual-only operation registration
Add `announcement_email` to `OperationKind` + `OPERATION_KINDS`, a `JOB.announcement_email`
body calling `dispatchAnnouncementEmail(emailFromName)`, a `runAnnouncementEmail` action, and
wire it into `overview.tsx`'s `RUN_ACTION` map. No entry in `OPERATION_SCHEDULES`, so the
overview renders it manual-only with no pause toggle automatically. **Why:** the overview
already branches on `kind in OPERATION_SCHEDULES`; nothing else needed.

## Risks / Trade-offs

- **Reusing `recap_digest` conflates unsubscribe scopes** → A player who opted out of recap
  digests also misses this announcement. Acceptable for a one-off; documented, and revisitable
  via the `announcements` key open question.
- **Large all-player fan-out vs. Resend limits/rate** → Chunk at the 100/batch ceiling and let
  the ledger make partial runs resumable; a rejected batch simply leaves its players pending.
- **Manual re-run double-send** → Prevented by writing the ledger only after acceptance and
  excluding ledgered users next run; same guarantee as winners.
- **Ledger write succeeds partially / fails after send** → Logged loudly; worst case is a
  duplicate on the next run, never a lost send (winners' documented trade-off).
- **Migration not auto-applied on deploy** → Follow the manual remote-migration runbook (apply
  SQL via pooler, record it, `NOTIFY pgrst`) before triggering the job in prod.

## Migration Plan

1. Land code + the `announcement_email_log` / CHECK-constraint migration.
2. Apply the migration to remote manually (pooler `psql`, record in the migration table,
   `NOTIFY pgrst, 'reload schema'`).
3. Verify the template in the admin **Operations → Emails → Previews** (`announcement`, both
   locales) before sending anything.
4. Fire **Operations → Overview → announcement_email → Run now**; confirm the summary counts.
5. Rollback: the change is additive — pause is N/A (manual-only); simply don't run the job.
   The table/kind can remain dormant with zero effect.

## Open Questions

- Should a first-class `announcements` email-pref key + account toggle be added later so
  gameplay-digest opt-outs and product-announcement opt-outs are independent? (Deferred.)
- Exact final feature list and CTA destination path on winscore.me — copy to be confirmed with
  the product owner before the prod send (does not block implementation; copy lives in i18n).
