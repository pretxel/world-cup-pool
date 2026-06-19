-- ===========================================================================
-- Allow the recap_digest operation kind in operation_runs
-- ---------------------------------------------------------------------------
-- The recap-digest cron records its runs via recordRun("recap_digest", ...).
-- operation_runs.kind is CHECK-constrained so a typo can't create a phantom
-- kind the dashboard never surfaces, so the new kind must be whitelisted.
--
-- Recreate the constraint with the full current set of operation kinds. The
-- original constraint (20260614050000_operation_runs.sql) listed only the first
-- four; results_digest was added to the application's OperationKind without a
-- matching DB constraint update, so it is included here too to keep the DB and
-- the app in sync. Purely additive — no existing row can violate a wider set.
-- ===========================================================================
alter table public.operation_runs
  drop constraint operation_runs_kind_check;

alter table public.operation_runs
  add constraint operation_runs_kind_check check (kind in (
    'sync_matches',
    'sync_news',
    'prediction_reminders',
    'quiz_reminders',
    'results_digest',
    'recap_digest'
  ));
