-- ===========================================================================
-- Fix: answer_quiz() — "column reference correct_index is ambiguous" (42702)
-- ---------------------------------------------------------------------------
-- The function's RETURNS TABLE declares an output column named `correct_index`,
-- which PL/pgSQL treats as a variable in scope. The body then SELECTed the
-- column `correct_index` UNQUALIFIED from quiz_questions, so Postgres could not
-- tell the OUT variable from the table column and raised 42702 on every call —
-- aborting before the answer was ever inserted. Result: 100% of quiz answer
-- submissions failed ("Couldn't submit your answer").
--
-- Fix: qualify the source columns with a table alias (qq.*). The RETURNS TABLE
-- column names (is_correct, correct_index) are unchanged, so the API contract
-- and the app's response parsing stay identical.
-- ===========================================================================

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

  select qq.id, qq.correct_index, qq.options, qq.active_on
    into q
  from public.quiz_questions qq
  where qq.id = p_question_id;

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
