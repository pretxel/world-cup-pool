-- ===========================================================================
-- Competition refactor — DB invariant tests
-- ---------------------------------------------------------------------------
-- Repeatable assertions for the trigger/guard/scoping behavior introduced by
-- the support-multiple-competitions migrations. Runs in a single transaction
-- and ROLLS BACK, so it never mutates seed data. Any failed assertion raises,
-- which aborts the run (use psql -v ON_ERROR_STOP=1) and exits non-zero.
--
-- Run against the local self-hosted stack:
--   docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
--     < supabase/tests/competition_invariants.sql
-- ===========================================================================

begin;

-- Helper: assert a statement raises (returns true if it did).
create or replace function pg_temp.raises(sql text) returns boolean
language plpgsql as $$
begin
  execute sql;
  return false;
exception when others then
  return true;
end;
$$;

-- 1. format_config shape validation (trigger on competitions) -----------------
do $$
begin
  if not pg_temp.raises($q$
    insert into public.competitions(slug,name,short_name,tournament_start_at,format_config)
    values ('t-empty','T','T',now(),'{"stages":[],"groups":{"enabled":false}}')
  $q$) then raise exception 'FAIL: empty stages accepted'; end if;

  if not pg_temp.raises($q$
    insert into public.competitions(slug,name,short_name,tournament_start_at,format_config)
    values ('t-dup','T','T',now(),
      '{"stages":[{"key":"x","kind":"knockout","order":1,"labels":{"en":"X"}},{"key":"x","kind":"knockout","order":2,"labels":{"en":"Y"}}],"groups":{"enabled":false}}')
  $q$) then raise exception 'FAIL: duplicate stage keys accepted'; end if;

  if not pg_temp.raises($q$
    insert into public.competitions(slug,name,short_name,tournament_start_at,format_config)
    values ('t-gc','T','T',now(),
      '{"stages":[{"key":"g","kind":"group","order":1,"hasGroupCode":true,"labels":{"en":"G"}}],"groups":{"enabled":false}}')
  $q$) then raise exception 'FAIL: hasGroupCode without groups.enabled accepted'; end if;
end $$;

-- 2. A valid league-only competition is accepted ------------------------------
insert into public.competitions(slug,name,short_name,tournament_start_at,format_config)
values ('t-league','League Cup','LC',now(),
  '{"stages":[{"key":"league","kind":"league","order":1,"hasGroupCode":false,"labels":{"en":"League"}},{"key":"final","kind":"knockout","order":2,"hasGroupCode":false,"labels":{"en":"Final"}}],"groups":{"enabled":false}}');

-- 3. match validation trigger against each competition's format ----------------
do $$
declare wc uuid := public.active_competition_id();
        lc uuid := (select id from public.competitions where slug='t-league');
begin
  -- WC: bad stage / bad group_code / knockout-with-group_code rejected
  if not pg_temp.raises(format($q$insert into public.matches(competition_id,stage,home_team,away_team,kickoff_at) values (%L,'bogus','A','B',now()+interval '1 day')$q$, wc))
    then raise exception 'FAIL: bad stage accepted (WC)'; end if;
  if not pg_temp.raises(format($q$insert into public.matches(competition_id,stage,group_code,home_team,away_team,kickoff_at) values (%L,'group','Z','A','B',now()+interval '1 day')$q$, wc))
    then raise exception 'FAIL: bad group_code accepted (WC)'; end if;
  if not pg_temp.raises(format($q$insert into public.matches(competition_id,stage,group_code,home_team,away_team,kickoff_at) values (%L,'final','A','A','B',now()+interval '1 day')$q$, wc))
    then raise exception 'FAIL: knockout group_code accepted (WC)'; end if;

  -- League-only: a league match with NULL group_code is accepted; with a code rejected
  insert into public.matches(competition_id,stage,home_team,away_team,kickoff_at)
    values (lc,'league','Home','Away',now()+interval '1 day');
  if not pg_temp.raises(format($q$insert into public.matches(competition_id,stage,group_code,home_team,away_team,kickoff_at) values (%L,'league','A','H','W',now()+interval '1 day')$q$, lc))
    then raise exception 'FAIL: league match with group_code accepted'; end if;
end $$;

-- 4. single-active invariant: two active rows violate the partial unique index
do $$
begin
  perform set_config('app.allow_active_change','1',true);
  if not pg_temp.raises($q$update public.competitions set is_active=true where slug='t-league'$q$)
    then raise exception 'FAIL: a second active competition was allowed'; end if;
  perform set_config('app.allow_active_change','0',true);
end $$;

-- 5. is_active guard: a direct flip without the GUC is blocked -----------------
do $$
begin
  if not pg_temp.raises($q$update public.competitions set is_active=false where slug='world-cup-2026'$q$)
    then raise exception 'FAIL: direct is_active update was allowed'; end if;
end $$;

-- 6. leaderboard scope parity: the overall view ranks exactly the users with a
--    score on an active-competition match -------------------------------------
do $$
declare v_view int; v_expected int;
begin
  select count(*) into v_view from public.v_leaderboard_overall;
  select count(distinct s.user_id) into v_expected
    from public.scores s
    join public.matches m on m.id = s.match_id
    where m.competition_id = public.active_competition_id();
  if v_view <> v_expected then
    raise exception 'FAIL: leaderboard scope mismatch (view % vs expected %)', v_view, v_expected;
  end if;
end $$;

rollback;

\echo 'OK: competition invariants passed'
