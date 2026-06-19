-- ===========================================================================
-- Add the recap_digest key to the profiles.email_prefs default
-- ---------------------------------------------------------------------------
-- The post-matchday recap digest is a new per-type email with its own opt-out.
-- It joins prediction_reminder / result / quiz_reminder / results_digest in
-- profiles.email_prefs. This only updates the column DEFAULT so new rows carry
-- the key; existing rows are safe untouched because a reader treats a missing
-- key as opted-in (`!== false`), so no destructive backfill is required.
-- ===========================================================================
alter table public.profiles
  alter column email_prefs set default
    '{"prediction_reminder":true,"result":true,"quiz_reminder":true,"results_digest":true,"recap_digest":true}'::jsonb;

-- Backfill the key into existing rows for completeness (default-on). Optional:
-- omitting it would still read as opted-in, but this keeps stored rows explicit.
update public.profiles
set email_prefs = email_prefs || '{"recap_digest":true}'::jsonb
where not (email_prefs ? 'recap_digest');
