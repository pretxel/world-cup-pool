-- ===========================================================================
-- Daily prediction reminder emails — ledger + opt-out
-- ---------------------------------------------------------------------------
-- A daily cron emails each opted-in player the day's still-open matches they
-- have not yet predicted, nudging them to pick before kickoff locks them out.
-- `prediction_reminder_log` gives at-most-once delivery per (user, day): a
-- player can have many pending matches on a given day, so the natural idempotency
-- key is the calendar date, not a single match. A row is written only after the
-- provider accepts the message, so the ledger survives idempotent re-runs and
-- crashes (mirrors public.quiz_reminder_log / public.result_email_log).
--
-- `profiles` gains a dedicated opt-out flag, independent of the quiz reminder,
-- reusing the existing per-profile `unsubscribe_token` for the one-click link.
-- Purely additive.
-- ===========================================================================

create table public.prediction_reminder_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, reminder_date)
);
create index prediction_reminder_log_date_idx
  on public.prediction_reminder_log (reminder_date);

alter table public.prediction_reminder_log enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- this ledger. Same "service-role only" posture as public.quiz_reminder_log.

-- ---------------------------------------------------------------------------
-- Email preference on profiles. Default opted-IN (the feature emails every
-- player with a pending pick). Independent of quiz_reminder_opt_out so a player
-- can keep one reminder and drop the other. Reuses the existing
-- profiles.unsubscribe_token (added in the quiz-reminder migration) for the
-- one-click unsubscribe route.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column prediction_reminder_opt_out boolean not null default false;
