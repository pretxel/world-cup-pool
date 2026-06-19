-- ===========================================================================
-- Recap-digest dedupe ledger (per rendered comic, per player)
-- ---------------------------------------------------------------------------
-- Records that a newly-rendered recap comic was emailed to a player. The
-- recap-digest cron scans match_summary_images rows with status='complete'
-- that have no ledger row for an eligible player and emails one digest per
-- player listing those new comics (thumbnail + match link + share link).
--
-- Keyed by (summary_image_id, user_id), NOT (match_id, user_id): the unit of
-- "new content" is a completed comic render, and a re-render of the same match
-- is a new digest-able item (one render per recap version,
-- match_summary_images_summary_uq). FK on summary_image_id cascades so deleting
-- a render drops its ledger rows. The row is written only after Resend accepts
-- the batch, giving at-most-once delivery per (comic, player) that survives
-- idempotent re-runs and crashes.
--
-- Purely additive. Written/read exclusively by the service-role admin client —
-- RLS is enabled with no policies, so no anon/authenticated access. Same
-- "definer/service-role only" posture as public.result_email_log and
-- public.results_digest_log.
-- ===========================================================================

create table public.recap_digest_email_log (
  summary_image_id uuid not null references public.match_summary_images(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (summary_image_id, user_id)
);
create index recap_digest_email_log_user_id_idx on public.recap_digest_email_log (user_id);

alter table public.recap_digest_email_log enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads or writes
-- this ledger. Same posture as public.result_email_log / results_digest_log.

-- ---------------------------------------------------------------------------
-- Backfill: pre-mark every already-`complete` recap comic as "sent" for every
-- existing player so shipping this feature never blasts historical recaps. The
-- first cron run then finds nothing pending for these images. Marking against
-- the current recipient set is sufficient — players who join after deploy only
-- get comics that complete after they join, which is the desired behavior.
-- ---------------------------------------------------------------------------
insert into public.recap_digest_email_log (summary_image_id, user_id)
select i.id, p.id
from public.match_summary_images i
cross join public.profiles p
where i.status = 'complete'
on conflict (summary_image_id, user_id) do nothing;
