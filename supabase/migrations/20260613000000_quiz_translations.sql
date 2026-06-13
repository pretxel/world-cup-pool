-- ===========================================================================
-- Daily Quiz — localized content (ES/FR)
-- Store optional per-locale translations of a question's prompt + options
-- alongside the English originals. English stays canonical: the existing
-- prompt/options columns are unchanged and remain the fallback.
--
-- Shape: { "es": { "prompt": text, "options": text[] }, "fr": { ... } }
-- The app's single write path (admin action) validates this shape; the public
-- read helper falls back to English on anything malformed. No correct_index
-- lives here, so the answer-omitting guarantee of the public view is preserved.
-- ===========================================================================

alter table public.quiz_questions
  add column translations jsonb not null default '{}'::jsonb;

-- Re-create the public view to expose translations. Still omits correct_index,
-- and still runs with owner rights (security_invoker = off) so it reads past
-- the admin-only RLS on the base table. `translations` is appended LAST:
-- create-or-replace can only add columns at the end of the existing list,
-- never reorder them (renaming a column raises SQLSTATE 42P16).
create or replace view public.v_quiz_questions_public
  with (security_invoker = off) as
select id, prompt, options, active_on, translations
from public.quiz_questions;

-- create or replace view does not reset grants, but be explicit so a clean
-- rebuild keeps anon/authenticated read access to the (still answer-free) view.
grant select on public.v_quiz_questions_public to anon, authenticated;
