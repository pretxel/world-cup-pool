-- ===========================================================================
-- Daily quiz reminder emails — ledger + opt-out
-- ---------------------------------------------------------------------------
-- A daily cron emails each opted-in user who has not yet answered the day's
-- active quiz question, nudging them to keep their streak. `quiz_reminder_log`
-- gives at-most-once delivery per (user, question) — and since exactly one
-- question is active per UTC day, that is at-most-once per user per day. A row
-- is written only after the provider accepts the message, so the ledger
-- survives idempotent re-runs and crashes (mirrors public.result_email_log).
--
-- `profiles` gains an opt-out flag and an opaque unsubscribe token so a logged-
-- out recipient can stop reminders via a one-click link. Purely additive.
-- ===========================================================================

create table public.quiz_reminder_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index quiz_reminder_log_question_id_idx
  on public.quiz_reminder_log (question_id);

alter table public.quiz_reminder_log enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- this ledger. Same "service-role only" posture as public.result_email_log.

-- ---------------------------------------------------------------------------
-- Email preferences on profiles. Default opted-IN (the feature emails every
-- user who hasn't answered), with a per-user opaque token backing the
-- one-click unsubscribe. The token is unique so the unsubscribe route can look
-- a user up by it without authentication.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column quiz_reminder_opt_out boolean not null default false,
  add column unsubscribe_token uuid not null default gen_random_uuid();

create unique index profiles_unsubscribe_token_idx
  on public.profiles (unsubscribe_token);
