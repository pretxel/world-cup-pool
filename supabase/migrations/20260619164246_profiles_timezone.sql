-- ===========================================================================
-- Per-user timezone on profiles (for timezone-segmented reminders)
-- ---------------------------------------------------------------------------
-- The prediction + quiz reminder crons fire hourly and email each user on the
-- run nearest 7am in their own timezone. A cron has no request — hence no `tz`
-- cookie — so the zone must be persisted where the cron can read it.
--
-- `profiles.timezone` holds a validated IANA zone (e.g. "America/New_York"),
-- populated from the same `tz` cookie the app already detects client-side
-- (<TimezoneSync/>). The value is validated with isValidTimeZone
-- (lib/match-utils.ts) before it is written, so a garbage cookie never lands in
-- the column. Nullable with no default: a user whose zone is not yet known is
-- bucketed as UTC by the dispatcher, so reminders never silently stop.
--
-- Written by the authenticated user's own row (existing owner RLS on profiles)
-- and read by the service-role admin client in the crons (RLS bypass). Purely
-- additive — no RLS change, no backfill.
-- ===========================================================================
alter table public.profiles
  add column timezone text;
