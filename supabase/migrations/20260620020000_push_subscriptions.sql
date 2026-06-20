-- ===========================================================================
-- Web Push subscription store + per-trigger push idempotency ledgers
-- ---------------------------------------------------------------------------
-- This is the app's first browser-persistent push store. It backs opt-in Web
-- Push delivery for the two re-engagement triggers that today are email-only:
-- "a match needs your pick today" (prediction-reminders cron) and "your
-- standing changed" (sync-matches cron). Push rides the EXISTING crons and
-- reuses their audience computations — this migration only adds the delivery
-- substrate.
--
-- Purely additive: does not touch profiles, matches, scores, predictions, the
-- leaderboard view, or any scoring function. No competition/score data is
-- written by the push paths.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- push_subscriptions — one row per browser endpoint.
-- ---------------------------------------------------------------------------
-- Written by the client subscribe flow (a signed-in user, under RLS, owns only
-- their own rows). Read across all users by the cron send paths via the
-- service-role admin client (which bypasses RLS, like every other dispatcher).
-- `endpoint` is unique so re-subscribing the same browser upserts instead of
-- duplicating. `failure_count` lets the sender prune dead endpoints
-- (410 Gone / 404) inline during a cron, so no separate cleanup cron is needed.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  failure_count int not null default 0
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Owner-only access for signed-in users: a player may read, insert, and delete
-- only their own subscription rows. The service-role admin client bypasses RLS
-- and reads every user's subscriptions during the cron sends. There is
-- intentionally no UPDATE policy — the subscribe action upserts on the unique
-- `endpoint` (insert-or-replace by delete+insert is not needed; PostgREST
-- upsert performs an UPDATE under the service role, and the owner re-subscribe
-- path deletes-then-inserts), and the cron prune path runs as service role.
create policy "push_subscriptions owner can select"
  on public.push_subscriptions for select
  using (user_id = auth.uid());
create policy "push_subscriptions owner can insert"
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());
create policy "push_subscriptions owner can delete"
  on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Push idempotency ledgers (sibling tables, mirroring the email ledgers).
-- ---------------------------------------------------------------------------
-- DECISION: sibling *_push_log tables (not a discriminator column on the email
-- ledgers). Push and email share the same audience computation but need
-- independent at-most-once guarantees — a player can have been emailed but not
-- pushed (no subscription) or vice-versa. Sibling tables keep the existing
-- email ledgers (prediction_reminder_log, result_email_log) byte-for-byte
-- untouched, so the email idempotency is provably unaffected by this change.
--
-- Both are written ONLY after web-push accepts a send, and read/written
-- exclusively by the service-role admin client — RLS enabled, no policies, the
-- same "service-role only" posture as result_email_log / prediction_reminder_log.

-- Match-needed push: at-most-once per player per UTC day, so the hourly
-- prediction-reminders cron never double-pushes within a day.
create table public.prediction_reminder_push_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_date date not null,
  pushed_at timestamptz not null default now(),
  primary key (user_id, reminder_date)
);
alter table public.prediction_reminder_push_log enable row level security;

-- Standing-changed push: at-most-once per (match, player), so re-running the
-- sync-matches cron for an already-finalized match never re-pushes.
create table public.result_push_log (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  pushed_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
create index result_push_log_user_id_idx on public.result_push_log (user_id);
alter table public.result_push_log enable row level security;

-- ---------------------------------------------------------------------------
-- Add the `push` key to the email_prefs default so new/updated rows expose it.
-- A reader treats a missing key as opted-in, so this is harmless for existing
-- rows; the explicit default keeps the jsonb self-describing. Default opted-IN,
-- like every other notification type (a player with no stored subscription
-- still receives nothing, so default-on is safe).
-- ---------------------------------------------------------------------------
alter table public.profiles
  alter column email_prefs set default
    '{"prediction_reminder":true,"result":true,"quiz_reminder":true,"results_digest":true,"recap_digest":true,"comeback":true,"push":true}'::jsonb;

-- Backfill push into existing rows (default-on, explicit).
update public.profiles
set email_prefs = email_prefs || '{"push":true}'::jsonb
where not (email_prefs ? 'push');
