-- ===========================================================================
-- World Cup 2026 Pool — Daily Quiz ("Daily Call")
-- One trivia question per UTC day, one-shot answering, separate leaderboard.
--
-- Secret answer: the correct option must never reach a client before they
-- answer. Postgres has no column-level RLS, so:
--   * quiz_questions base table is admin-only (read + write).
--   * a public view exposes every column EXCEPT correct_index.
--   * answering goes through a SECURITY DEFINER function that grades
--     server-side and returns correct_index only after writing the answer.
-- ===========================================================================

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null check (char_length(prompt) > 0),
  options text[] not null check (array_length(options, 1) between 2 and 4),
  correct_index smallint not null check (correct_index >= 0),
  active_on date not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_correct_index_in_range
    check (correct_index < array_length(options, 1))
);

create trigger trg_quiz_questions_updated_at
  before update on public.quiz_questions
  for each row execute function public.set_updated_at();

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  choice_index smallint not null check (choice_index >= 0),
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (user_id, question_id)
);
create index quiz_answers_user_id_idx on public.quiz_answers (user_id);
create index quiz_answers_question_id_idx on public.quiz_answers (question_id);

-- ---------------------------------------------------------------------------
-- Public, answer-omitting view. Runs with the view owner's rights (default,
-- security_invoker = off), so it bypasses the admin-only RLS on the base
-- table while exposing only the safe columns.
-- ---------------------------------------------------------------------------
-- security_invoker = off is pinned explicitly (not left to the default) so the
-- view keeps running with owner rights and can read past the admin-only RLS to
-- expose the safe columns. Flipping this to on would make the public page
-- return zero rows.
create or replace view public.v_quiz_questions_public
  with (security_invoker = off) as
select id, prompt, options, active_on
from public.quiz_questions;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.quiz_questions enable row level security;
alter table public.quiz_answers   enable row level security;

-- Questions base table: admin-only. Everyone else reads the public view.
create policy "quiz_questions_admin_all"
  on public.quiz_questions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Answers: a user may read their own; inserts happen only through answer_quiz
-- (SECURITY DEFINER), so there is intentionally no direct insert policy. No
-- update/delete — answers are immutable.
create policy "quiz_answers_select_own"
  on public.quiz_answers for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Atomic, secret-preserving grading. Verifies the question is today's, writes
-- the answer (unique constraint rejects a second attempt), and returns the
-- correct index only as the result — never before the row exists.
-- ---------------------------------------------------------------------------
create or replace function public.answer_quiz(p_question_id uuid, p_choice smallint)
returns table (is_correct boolean, correct_index smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  v_uid uuid := auth.uid();
  v_correct boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select id, correct_index, options, active_on
    into q
  from public.quiz_questions
  where id = p_question_id;

  if not found then
    raise exception 'question not found';
  end if;
  if q.active_on <> (now() at time zone 'utc')::date then
    raise exception 'question is not active today';
  end if;
  if p_choice < 0 or p_choice >= array_length(q.options, 1) then
    raise exception 'choice out of range';
  end if;

  v_correct := (p_choice = q.correct_index);

  -- Duplicate (user_id, question_id) raises unique_violation → one shot only.
  insert into public.quiz_answers (user_id, question_id, choice_index, is_correct)
  values (v_uid, p_question_id, p_choice, v_correct);

  return query select v_correct, q.correct_index;
end;
$$;

-- ---------------------------------------------------------------------------
-- Separate quiz leaderboard (mirrors v_leaderboard_overall).
-- 10 points per correct answer; ties break on earliest first answer.
-- ---------------------------------------------------------------------------
create or replace view public.v_quiz_leaderboard as
with agg as (
  select
    a.user_id,
    (count(*) filter (where a.is_correct) * 10)::int as total_points,
    count(*)::int as total_answered,
    min(a.answered_at) as first_answer
  from public.quiz_answers a
  group by a.user_id
)
select
  ag.user_id,
  pr.display_name,
  ag.total_points,
  ag.total_answered,
  ag.first_answer,
  rank() over (order by ag.total_points desc, ag.first_answer asc) as rank
from agg ag
join public.profiles pr on pr.id = ag.user_id;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Defensive: revoke the implicit base-table SELECT Supabase grants by default,
-- so the secret correct_index can only ever be reached through the
-- answer-omitting view. Even a future stray "select using (true)" policy would
-- still need this grant re-added to expose the table.
revoke select on public.quiz_questions from anon, authenticated;

grant select on public.v_quiz_questions_public to anon, authenticated;
grant select on public.v_quiz_leaderboard      to anon, authenticated;
grant execute on function public.answer_quiz(uuid, smallint) to authenticated;
