-- ===========================================================================
-- DEV ONLY — sample group-stage results so /standings renders real tables.
-- ===========================================================================
--
-- Marks a subset of group fixtures `final` with scorelines, covering all three
-- standings states the page must handle:
--   Groups A & B — fully played (6/6)
--   Groups C & D — partially played (3/6, 2/6)
--   Groups E–L   — untouched (scheduled → seeded at 0)
--
-- MUST run AFTER matches.sql (which truncates + reseeds every fixture as
-- scheduled). Idempotent: an UPDATE keyed on group + team names, safe to re-run.
-- NOT for production — the cron/result-sync owns real results there.
begin;
update public.matches m
set status = 'final', home_score = s.h, away_score = s.a
from (values
  -- Group A (all 6 played)
  ('A','Mexico','South Africa',2,1),
  ('A','South Korea','Czech Republic',1,1),
  ('A','Czech Republic','South Africa',0,2),
  ('A','Mexico','South Korea',1,0),
  ('A','Czech Republic','Mexico',1,1),
  ('A','South Africa','South Korea',0,3),
  -- Group B (all 6 played)
  ('B','Canada','Bosnia and Herzegovina',3,0),
  ('B','Qatar','Switzerland',0,1),
  ('B','Switzerland','Bosnia and Herzegovina',2,2),
  ('B','Canada','Qatar',1,1),
  ('B','Switzerland','Canada',0,1),
  ('B','Bosnia and Herzegovina','Qatar',2,0),
  -- Group C (3 of 6 played — partial)
  ('C','Brazil','Morocco',2,0),
  ('C','Haiti','Scotland',1,2),
  ('C','Scotland','Morocco',1,1),
  -- Group D (2 of 6 played — partial)
  ('D','United States','Paraguay',1,0),
  ('D','Australia','Turkey',2,1)
) as s(grp,home,away,h,a)
where m.stage = 'group'
  and m.group_code = s.grp
  and m.home_team = s.home
  and m.away_team = s.away;
commit;
