-- ===========================================================================
-- Competition-agnostic refactor — M3 + M4: scope matches to a competition
-- ---------------------------------------------------------------------------
-- Adds matches.competition_id (backfilled to World Cup 2026), then replaces the
-- hardcoded stage/group_code CHECK constraints with a trigger that validates
-- each match against ITS competition's format_config. The legacy CHECKs are
-- only dropped after a guarded assertion proves every existing row still
-- validates, so the swap is safe on live data.
--
-- Rollback:
--   alter table public.matches
--     add constraint matches_stage_check
--       check (stage in ('group','r32','r16','qf','sf','third','final')),
--     add constraint matches_group_code_check
--       check (group_code is null or group_code ~ '^[A-L]$');
--   drop trigger trg_matches_validate_competition on public.matches;
--   drop function public.validate_match_against_competition();
--   alter table public.matches drop column competition_id;
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- M3: competition_id column + backfill + indexes
-- ---------------------------------------------------------------------------

alter table public.matches
  add column competition_id uuid references public.competitions(id) on delete restrict;

update public.matches
  set competition_id = (select id from public.competitions where slug = 'world-cup-2026')
  where competition_id is null;

alter table public.matches
  alter column competition_id set not null;

create index matches_competition_kickoff_idx
  on public.matches (competition_id, kickoff_at);
create index matches_competition_status_idx
  on public.matches (competition_id, status);

-- ---------------------------------------------------------------------------
-- M4: per-competition stage/group_code validation trigger
-- ---------------------------------------------------------------------------
-- Validates NEW.stage against the match's competition format_config.stages
-- keys, and NEW.group_code against the competition's group pattern: required &
-- matching when the stage has hasGroupCode, NULL otherwise.
-- ---------------------------------------------------------------------------

create or replace function public.validate_match_against_competition()
returns trigger
language plpgsql
as $$
declare
  v_config jsonb;
  v_stage jsonb;
  v_has_group_code boolean;
  v_groups jsonb;
  v_groups_enabled boolean;
  v_pattern text;
begin
  select format_config into v_config
  from public.competitions
  where id = new.competition_id;

  if v_config is null then
    raise exception 'match references unknown competition %', new.competition_id;
  end if;

  -- Find the stage definition by key.
  select s into v_stage
  from jsonb_array_elements(v_config -> 'stages') s
  where s ->> 'key' = new.stage
  limit 1;

  if v_stage is null then
    raise exception 'stage % is not valid for competition %', new.stage, new.competition_id;
  end if;

  v_has_group_code := coalesce((v_stage ->> 'hasGroupCode')::boolean, false);
  v_groups := v_config -> 'groups';
  v_groups_enabled := coalesce((v_groups ->> 'enabled')::boolean, false);

  if v_has_group_code and v_groups_enabled then
    v_pattern := v_groups ->> 'pattern';
    if new.group_code is null or new.group_code !~ v_pattern then
      raise exception 'group_code % is invalid for stage % of competition %',
        new.group_code, new.stage, new.competition_id;
    end if;
  else
    if new.group_code is not null then
      raise exception 'group_code must be null for stage % of competition %',
        new.stage, new.competition_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_matches_validate_competition
  before insert or update on public.matches
  for each row execute function public.validate_match_against_competition();

-- ---------------------------------------------------------------------------
-- Guarded swap: assert every existing row validates BEFORE dropping the CHECKs.
-- ---------------------------------------------------------------------------

do $$
declare
  v_bad int;
begin
  select count(*) into v_bad
  from public.matches m
  join public.competitions c on c.id = m.competition_id
  where not exists (
    select 1 from jsonb_array_elements(c.format_config -> 'stages') s
    where s ->> 'key' = m.stage
  );
  if v_bad > 0 then
    raise exception 'aborting CHECK drop: % matches have a stage not in their competition format', v_bad;
  end if;
end;
$$;

alter table public.matches drop constraint if exists matches_stage_check;
alter table public.matches drop constraint if exists matches_group_code_check;

-- Lightweight residual backstop (the trigger is the real authority).
alter table public.matches
  add constraint matches_stage_present check (char_length(stage) > 0),
  add constraint matches_group_code_len check (group_code is null or char_length(group_code) <= 8);
