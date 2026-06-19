-- ===========================================================================
-- Comeback (re-engagement) emails — cooldown ledger + opt-out + run kind
-- ---------------------------------------------------------------------------
-- A once-daily cron emails *inactive* players — those with a past pick but no
-- prediction in the last N days (default 5) who still have a confirmed,
-- still-pickable upcoming match — nudging them back with their days-since-last-
-- pick, current rank, and the next matches to pick. Every existing email targets
-- still-engaged players; the comeback email is the inverse trigger, reactivating
-- churned users who today receive nothing.
--
-- `comeback_email_log` is a per-recipient cooldown ledger: a player is eligible
-- only when they have no row whose `sent_at` is newer than the cooldown window
-- (default 14 days), so a churned player gets at most one nudge per cooldown
-- period even if they stay inactive for weeks. Unlike prediction_reminder_log
-- (keyed by (user, day)), a player may be nudged across many cooldown cycles
-- over the tournament, so the natural query is "newest sent_at per user" — hence
-- a (user_id, sent_at) shape with an index, not a (user, date) primary key.
--
-- A row is written only after the provider accepts the batch, so the ledger
-- survives idempotent re-runs and crashes (mirrors public.prediction_reminder_log
-- / public.result_email_log). RLS enabled with NO policies: only the service-role
-- key (the cron dispatcher, which bypasses RLS) reads or writes it.
--
-- IMPORTANT: this ledger is intentionally NOT backfilled. An empty ledger
-- correctly makes every currently-inactive player eligible for their first
-- nudge — the whole point of the feature is to reach the existing churned
-- cohort. Purely additive.
-- ===========================================================================

create table public.comeback_email_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now()
);
create index comeback_email_log_user_sent_idx
  on public.comeback_email_log (user_id, sent_at);

alter table public.comeback_email_log enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- this ledger. Same "service-role only" posture as public.prediction_reminder_log
-- and public.result_email_log.

-- ---------------------------------------------------------------------------
-- Add the `comeback` key (default opted-IN) to the profiles.email_prefs jsonb
-- default. Existing rows are safe with no destructive backfill: a reader treats
-- a missing/unknown key as opted-in (`!== false`), so a profile written before
-- this change still receives comeback mail unless it later opts out.
-- ---------------------------------------------------------------------------
alter table public.profiles
  alter column email_prefs set default
    '{"prediction_reminder":true,"result":true,"quiz_reminder":true,"comeback":true}'::jsonb;

-- ---------------------------------------------------------------------------
-- Allow the new operation kind in the operation_runs ledger so the comeback
-- cron's runs surface in the admin operations control room alongside the four
-- existing jobs. Drop + recreate the CHECK constraint with the added value.
-- ---------------------------------------------------------------------------
alter table public.operation_runs
  drop constraint operation_runs_kind_check;
alter table public.operation_runs
  add constraint operation_runs_kind_check check (kind in (
    'sync_matches', 'sync_news', 'prediction_reminders', 'quiz_reminders', 'comeback_emails'
  ));
