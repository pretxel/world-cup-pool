-- ===========================================================================
-- One-time welcome email guard on profiles
-- ---------------------------------------------------------------------------
-- The welcome email fires exactly once per user, the first time they set a
-- display name during onboarding. `welcome_email_sent_at` is the at-most-once
-- marker: the sender treats a non-null value as "already sent" and no-ops, and
-- only stamps it after the email provider accepts the message — so a failed
-- send leaves it null and the email can still go out on a later onboarding
-- action. Nullable with no default (null = "not yet sent").
--
-- Only the service-role (admin) client reads/writes this column, from the
-- welcome-email sender; it bypasses RLS, so no end-user RLS policy change is
-- needed (the existing profiles policies stay as-is). Purely additive.
-- ===========================================================================

alter table public.profiles
  add column welcome_email_sent_at timestamptz;

comment on column public.profiles.welcome_email_sent_at is
  'When the one-time onboarding welcome email was sent (null = not yet sent). '
  'Written only by the service-role welcome-email sender after the provider '
  'accepts the message; no end-user RLS change required.';
