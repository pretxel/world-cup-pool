# Design: admin-disable-crons

## Context

Eight cron routes under `app/api/cron/*/route.ts` fire on schedules defined in `vercel.json`. Each route already follows a common shape: Bearer `CRON_SECRET` auth, a `skipped(reason)` helper returning `204` with an `x-skipped` header for missing-env cases, then the job body wrapped in `recordRun(kind, "cron", fn)` (`lib/operations/record-run.ts`), which writes an `operation_runs` row via the service-role client.

The admin operations control room (`app/[locale]/(admin)/admin/operations/`) renders one tile per `OperationKind` with last-run status, next scheduled run (from `lib/operations/schedule.ts`), and a "Run now" form posting to a server action guarded by `assertAdmin()`. `score_rules_email` is manual-only (no schedule entry).

Vercel crons cannot be toggled at runtime — changing `vercel.json` requires a redeploy — so the kill switch must live in the app: the schedule still fires, but the route declines to run.

## Goals / Non-Goals

**Goals:**
- Admin can pause/resume any scheduled job at runtime, without a deploy.
- A paused job's cron invocation is a cheap no-op that neither executes the job nor pollutes the run ledger.
- Paused state is visible on the operations overview.
- Manual "Run now" keeps working while a job is paused.

**Non-Goals:**
- Editing cron schedules (times/frequency) from the admin — only on/off.
- Pausing manual-only jobs (nothing scheduled to pause).
- A global "pause everything" switch (per-job covers it; can be added later).
- Fixing the existing `recap_digest` schedule drift between `schedule.ts` (`0 6,14,22 * * *`) and `vercel.json` (`0 18 * * *`) — out of scope, but worth a follow-up.

## Decisions

### 1. Persist the switch in a new `operation_settings` table

One row per `OperationKind`: `kind text primary key`, `enabled boolean not null default true`, `updated_at timestamptz`. **Absent row means enabled**, so no seeding is needed and new job kinds are automatically on. RLS enabled with **no policies** — exactly the `operation_runs` pattern: only the service-role client (crons, admin server actions, admin pages behind the `is_admin` gate) can touch it.

*Alternatives considered:* env vars or `vercel.json` edits (require redeploy — defeats the purpose); Vercel feature flags / external flag service (new dependency for one boolean per job; the project already standardizes on Supabase); a JSON blob in a generic settings table (no generic settings table exists; a typed per-kind row is simpler and queryable).

### 2. Check in the cron route via a shared helper, skipping with the existing `204` pattern

New `lib/operations/settings.ts` exposes `isOperationEnabled(kind)` (service-role read, single row lookup). Each cron route calls it **after auth, before the job**, and returns `skipped("disabled")` when off — the same `204 + x-skipped` shape already used for missing env, so Vercel sees a successful invocation and existing monitoring conventions hold. No `operation_runs` row is written for a skip, consistent with the missing-env skips today.

The helper **fails open**: if the settings read throws or errors, log and treat the job as enabled. A broken settings lookup must not silently halt every scheduled job; the switch is a convenience control, not a safety interlock.

*Alternative considered:* embedding the check inside `recordRun` — rejected because `recordRun` also wraps manual runs (which must bypass the switch) and its contract is "observe, never alter the job".

### 3. Manual "Run now" bypasses the switch

Pausing expresses "stop the schedule", not "forbid this job". The admin pressing "Run now" is deliberate; blocking it would force a resume/run/pause dance. The server actions in `actions.ts` therefore do not consult the setting.

### 4. Toggle as a server-action form on each tile, matching the page's RSC idiom

The overview is a server component using plain `<form action>` + `SubmitButton` (no client state). The toggle follows suit: a small "Pause"/"Resume" form button on each scheduled job's tile posting to a new `setOperationEnabled` action (guarded by the existing `assertAdmin()`, then `revalidatePath` + redirect back, like `trigger()`). A paused job's tile shows a "Paused" badge and replaces the next-run time with a paused label. Manual-only jobs (no `OPERATION_SCHEDULES` entry) render no toggle.

*Alternative considered:* client-side shadcn `Switch` with optimistic state — nicer micro-interaction, but introduces the page's first client mutation path for marginal gain; form round-trip matches every other control on this page.

### 5. Overview reads settings in one query

A `getOperationSettings()` helper returns a `Record<OperationKind, boolean>` (default true) so the overview does one fetch alongside `getLatestRunPerKind()`, not one per tile.

## Risks / Trade-offs

- [Fail-open means a Supabase outage runs jobs the admin paused] → Acceptable: outage windows are short, jobs are idempotent via their existing ledgers, and fail-closed would be worse (all crons silently dead).
- [Every cron invocation adds one DB read] → Single-row PK lookup on an 8-row table; negligible next to the jobs themselves.
- [Skips leave no trace in `operation_runs`] → Matches existing missing-env skip semantics; the overview's "Paused" badge plus the `x-skipped: disabled` header in Vercel logs cover diagnosis. Recording skips would flood the ledger with daily no-op rows.
- [Toggle races (two admins)] → Last write wins on a single boolean; harmless.

## Migration Plan

1. Additive migration creating `operation_settings` (no backfill; absent = enabled). Regenerate `database.types.ts`.
2. Ship helper + route checks + UI in one deploy; default-enabled means behavior is unchanged until an admin pauses something.
3. Rollback: revert the code deploy; the table can stay (inert) or be dropped in a follow-up migration.
