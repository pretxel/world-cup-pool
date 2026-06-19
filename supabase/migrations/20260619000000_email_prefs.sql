-- ===========================================================================
-- Per-type email preferences on profiles (in-app source of truth)
-- ---------------------------------------------------------------------------
-- The app sends three emails — the prediction reminder, the result email, and
-- the quiz reminder — but a signed-in player had no in-app way to choose which
-- ones they receive. The only opt-out was the footer one-click link, which
-- flipped a single per-type boolean (prediction_reminder_opt_out /
-- quiz_reminder_opt_out) with no re-opt-in path, and the result email honored
-- no opt-out at all.
--
-- `profiles.email_prefs` becomes the single read source for all three toggles:
-- one jsonb object, each key defaulting to opted-IN (the features email every
-- eligible player). A reader treats a missing/unknown key as opted-in
-- (`!== false`), so partial rows are always safe.
--
-- The legacy boolean columns are kept (the footer unsubscribe routes still
-- write them, now alongside the matching email_prefs key); they are simply no
-- longer the read source. Purely additive.
-- ===========================================================================
alter table public.profiles
  add column email_prefs jsonb not null
    default '{"prediction_reminder":true,"result":true,"quiz_reminder":true}'::jsonb;

-- Backfill from the existing per-type opt-outs so no current choice is lost.
-- An opted-out boolean (true) maps to an opted-in preference of false. The
-- result email had no prior opt-out, so it backfills as opted-in (true).
update public.profiles
set email_prefs = jsonb_build_object(
  'prediction_reminder', not coalesce(prediction_reminder_opt_out, false),
  'result', true,
  'quiz_reminder', not coalesce(quiz_reminder_opt_out, false)
);
