-- ===========================================================================
-- Group-invite abuse / rate-limiting ledger
-- ---------------------------------------------------------------------------
-- Records that a group member sent an email invite (a direct join link) to a
-- recipient address. `inviteToGroupByEmailAction` counts an inviter's rows in a
-- rolling window before sending and rejects submissions that would exceed the
-- per-inviter (and per-group) caps; a row is written only after Resend accepts
-- the corresponding message, so the ledger reflects real sends and survives
-- idempotent retries. Doubles as an abuse audit trail (who emailed whom, when).
--
-- Purely additive: does not touch groups, group_members, join_group, or
-- group_preview. Written/read exclusively by the service-role admin client —
-- RLS is enabled with no policies, so no anon/authenticated access. Same
-- "definer/service-role only" posture as public.result_email_log.
-- ===========================================================================

create table public.group_invite_log (
  group_id uuid not null references public.groups(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  sent_at timestamptz not null default now()
);
-- Rolling-window counts are keyed on the inviter and the send time.
create index group_invite_log_inviter_sent_at_idx
  on public.group_invite_log (inviter_id, sent_at);
-- Per-(inviter, group) window counts.
create index group_invite_log_inviter_group_idx
  on public.group_invite_log (inviter_id, group_id);

alter table public.group_invite_log enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- this ledger. Same "definer/service-role only" posture as
-- public.result_email_log.
