-- ===========================================================================
-- FIFA World Cup 2026 — match fixtures seed (auto-generated)
-- ===========================================================================
--
-- Source: en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_{A..L}
--         en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage
-- Generator: scripts/generate-fixtures-sql.mjs
--
-- 72 group matches + 32 knockout matches = 104 total.
-- Knockout home/away use placeholder labels (e.g. "Winner Group A") that an
-- admin can rename via the admin UI once group standings are decided.
--
-- All kickoff_at values are UTC. Local kickoff times were converted using the
-- canonical IANA timezone per venue (no DST for Mexico Pacific/Central, EDT/CDT/PDT
-- for US/Canada in June–July 2026).
-- ---------------------------------------------------------------------------

begin;

truncate public.matches restart identity cascade;

insert into public.matches (stage, group_code, home_team, away_team, kickoff_at, venue) values
  ('group', 'A', 'Mexico', 'South Africa', '2026-06-11T19:00:00Z', 'Estadio Azteca, Mexico City'),
  ('group', 'A', 'South Korea', 'Czech Republic', '2026-06-12T02:00:00Z', 'Estadio Akron, Zapopan'),
  ('group', 'A', 'Czech Republic', 'South Africa', '2026-06-18T16:00:00Z', 'Mercedes-Benz Stadium, Atlanta'),
  ('group', 'A', 'Mexico', 'South Korea', '2026-06-19T01:00:00Z', 'Estadio Akron, Zapopan'),
  ('group', 'A', 'Czech Republic', 'Mexico', '2026-06-25T01:00:00Z', 'Estadio Azteca, Mexico City'),
  ('group', 'A', 'South Africa', 'South Korea', '2026-06-25T01:00:00Z', 'Estadio BBVA, Guadalupe'),
  ('group', 'B', 'Canada', 'Bosnia and Herzegovina', '2026-06-12T19:00:00Z', 'BMO Field, Toronto'),
  ('group', 'B', 'Qatar', 'Switzerland', '2026-06-13T19:00:00Z', 'Levi''s Stadium, Santa Clara'),
  ('group', 'B', 'Switzerland', 'Bosnia and Herzegovina', '2026-06-18T19:00:00Z', 'SoFi Stadium, Inglewood'),
  ('group', 'B', 'Canada', 'Qatar', '2026-06-18T22:00:00Z', 'BC Place, Vancouver'),
  ('group', 'B', 'Switzerland', 'Canada', '2026-06-24T19:00:00Z', 'BC Place, Vancouver'),
  ('group', 'B', 'Bosnia and Herzegovina', 'Qatar', '2026-06-24T19:00:00Z', 'Lumen Field, Seattle'),
  ('group', 'C', 'Brazil', 'Morocco', '2026-06-13T22:00:00Z', 'MetLife Stadium, East Rutherford'),
  ('group', 'C', 'Haiti', 'Scotland', '2026-06-14T01:00:00Z', 'Gillette Stadium, Foxborough'),
  ('group', 'C', 'Scotland', 'Morocco', '2026-06-19T22:00:00Z', 'Gillette Stadium, Foxborough'),
  ('group', 'C', 'Brazil', 'Haiti', '2026-06-20T00:30:00Z', 'Lincoln Financial Field, Philadelphia'),
  ('group', 'C', 'Scotland', 'Brazil', '2026-06-24T22:00:00Z', 'Hard Rock Stadium, Miami Gardens'),
  ('group', 'C', 'Morocco', 'Haiti', '2026-06-24T22:00:00Z', 'Mercedes-Benz Stadium, Atlanta'),
  ('group', 'D', 'United States', 'Paraguay', '2026-06-13T01:00:00Z', 'SoFi Stadium, Inglewood'),
  ('group', 'D', 'Australia', 'Turkey', '2026-06-14T04:00:00Z', 'BC Place, Vancouver'),
  ('group', 'D', 'United States', 'Australia', '2026-06-19T19:00:00Z', 'Lumen Field, Seattle'),
  ('group', 'D', 'Turkey', 'Paraguay', '2026-06-20T03:00:00Z', 'Levi''s Stadium, Santa Clara'),
  ('group', 'D', 'Turkey', 'United States', '2026-06-26T02:00:00Z', 'SoFi Stadium, Inglewood'),
  ('group', 'D', 'Paraguay', 'Australia', '2026-06-26T02:00:00Z', 'Levi''s Stadium, Santa Clara'),
  ('group', 'E', 'Germany', 'Curaçao', '2026-06-14T17:00:00Z', 'NRG Stadium, Houston'),
  ('group', 'E', 'Ivory Coast', 'Ecuador', '2026-06-14T23:00:00Z', 'Lincoln Financial Field, Philadelphia'),
  ('group', 'E', 'Germany', 'Ivory Coast', '2026-06-20T20:00:00Z', 'BMO Field, Toronto'),
  ('group', 'E', 'Ecuador', 'Curaçao', '2026-06-21T00:00:00Z', 'Arrowhead Stadium, Kansas City'),
  ('group', 'E', 'Curaçao', 'Ivory Coast', '2026-06-25T20:00:00Z', 'Lincoln Financial Field, Philadelphia'),
  ('group', 'E', 'Ecuador', 'Germany', '2026-06-25T20:00:00Z', 'MetLife Stadium, East Rutherford'),
  ('group', 'F', 'Netherlands', 'Japan', '2026-06-14T20:00:00Z', 'AT&T Stadium, Arlington'),
  ('group', 'F', 'Sweden', 'Tunisia', '2026-06-15T02:00:00Z', 'Estadio BBVA, Guadalupe'),
  ('group', 'F', 'Netherlands', 'Sweden', '2026-06-20T17:00:00Z', 'NRG Stadium, Houston'),
  ('group', 'F', 'Tunisia', 'Japan', '2026-06-21T04:00:00Z', 'Estadio BBVA, Guadalupe'),
  ('group', 'F', 'Japan', 'Sweden', '2026-06-25T23:00:00Z', 'AT&T Stadium, Arlington'),
  ('group', 'F', 'Tunisia', 'Netherlands', '2026-06-25T23:00:00Z', 'Arrowhead Stadium, Kansas City'),
  ('group', 'G', 'Belgium', 'Egypt', '2026-06-15T19:00:00Z', 'Lumen Field, Seattle'),
  ('group', 'G', 'Iran', 'New Zealand', '2026-06-16T01:00:00Z', 'SoFi Stadium, Inglewood'),
  ('group', 'G', 'Belgium', 'Iran', '2026-06-21T19:00:00Z', 'SoFi Stadium, Inglewood'),
  ('group', 'G', 'New Zealand', 'Egypt', '2026-06-22T01:00:00Z', 'BC Place, Vancouver'),
  ('group', 'G', 'Egypt', 'Iran', '2026-06-27T03:00:00Z', 'Lumen Field, Seattle'),
  ('group', 'G', 'New Zealand', 'Belgium', '2026-06-27T03:00:00Z', 'BC Place, Vancouver'),
  ('group', 'H', 'Spain', 'Cape Verde', '2026-06-15T16:00:00Z', 'Mercedes-Benz Stadium, Atlanta'),
  ('group', 'H', 'Saudi Arabia', 'Uruguay', '2026-06-15T22:00:00Z', 'Hard Rock Stadium, Miami Gardens'),
  ('group', 'H', 'Spain', 'Saudi Arabia', '2026-06-21T16:00:00Z', 'Mercedes-Benz Stadium, Atlanta'),
  ('group', 'H', 'Uruguay', 'Cape Verde', '2026-06-21T22:00:00Z', 'Hard Rock Stadium, Miami Gardens'),
  ('group', 'H', 'Cape Verde', 'Saudi Arabia', '2026-06-27T00:00:00Z', 'NRG Stadium, Houston'),
  ('group', 'H', 'Uruguay', 'Spain', '2026-06-27T00:00:00Z', 'Estadio Akron, Zapopan'),
  ('group', 'I', 'France', 'Senegal', '2026-06-16T19:00:00Z', 'MetLife Stadium, East Rutherford'),
  ('group', 'I', 'Iraq', 'Norway', '2026-06-16T22:00:00Z', 'Gillette Stadium, Foxborough'),
  ('group', 'I', 'France', 'Iraq', '2026-06-22T21:00:00Z', 'Lincoln Financial Field, Philadelphia'),
  ('group', 'I', 'Norway', 'Senegal', '2026-06-23T00:00:00Z', 'MetLife Stadium, East Rutherford'),
  ('group', 'I', 'Norway', 'France', '2026-06-26T19:00:00Z', 'Gillette Stadium, Foxborough'),
  ('group', 'I', 'Senegal', 'Iraq', '2026-06-26T19:00:00Z', 'BMO Field, Toronto'),
  ('group', 'J', 'Argentina', 'Algeria', '2026-06-17T01:00:00Z', 'Arrowhead Stadium, Kansas City'),
  ('group', 'J', 'Austria', 'Jordan', '2026-06-17T04:00:00Z', 'Levi''s Stadium, Santa Clara'),
  ('group', 'J', 'Argentina', 'Austria', '2026-06-22T17:00:00Z', 'AT&T Stadium, Arlington'),
  ('group', 'J', 'Jordan', 'Algeria', '2026-06-23T03:00:00Z', 'Levi''s Stadium, Santa Clara'),
  ('group', 'J', 'Algeria', 'Austria', '2026-06-28T02:00:00Z', 'Arrowhead Stadium, Kansas City'),
  ('group', 'J', 'Jordan', 'Argentina', '2026-06-28T02:00:00Z', 'AT&T Stadium, Arlington'),
  ('group', 'K', 'Portugal', 'DR Congo', '2026-06-17T17:00:00Z', 'NRG Stadium, Houston'),
  ('group', 'K', 'Uzbekistan', 'Colombia', '2026-06-18T02:00:00Z', 'Estadio Azteca, Mexico City'),
  ('group', 'K', 'Portugal', 'Uzbekistan', '2026-06-23T17:00:00Z', 'NRG Stadium, Houston'),
  ('group', 'K', 'Colombia', 'DR Congo', '2026-06-24T02:00:00Z', 'Estadio Akron, Zapopan'),
  ('group', 'K', 'Colombia', 'Portugal', '2026-06-27T23:30:00Z', 'Hard Rock Stadium, Miami Gardens'),
  ('group', 'K', 'DR Congo', 'Uzbekistan', '2026-06-27T23:30:00Z', 'Mercedes-Benz Stadium, Atlanta'),
  ('group', 'L', 'England', 'Croatia', '2026-06-17T20:00:00Z', 'AT&T Stadium, Arlington'),
  ('group', 'L', 'Ghana', 'Panama', '2026-06-17T23:00:00Z', 'BMO Field, Toronto'),
  ('group', 'L', 'England', 'Ghana', '2026-06-23T20:00:00Z', 'Gillette Stadium, Foxborough'),
  ('group', 'L', 'Panama', 'Croatia', '2026-06-23T23:00:00Z', 'BMO Field, Toronto'),
  ('group', 'L', 'Panama', 'England', '2026-06-27T21:00:00Z', 'MetLife Stadium, East Rutherford'),
  ('group', 'L', 'Croatia', 'Ghana', '2026-06-27T21:00:00Z', 'Lincoln Financial Field, Philadelphia'),
  ('r32', null, '2nd Group A', '2nd Group B', '2026-06-28T19:00:00Z', 'SoFi Stadium, Inglewood'),
  ('r32', null, 'Winner Group C', '2nd Group F', '2026-06-29T17:00:00Z', 'NRG Stadium, Houston'),
  ('r32', null, 'Winner Group E', '3rd Group A/B/C/D/F', '2026-06-29T20:30:00Z', 'Gillette Stadium, Foxborough'),
  ('r32', null, 'Winner Group F', '2nd Group C', '2026-06-30T01:00:00Z', 'Estadio BBVA, Guadalupe'),
  ('r32', null, '2nd Group E', '2nd Group I', '2026-06-30T17:00:00Z', 'AT&T Stadium, Arlington'),
  ('r32', null, 'Winner Group I', '3rd Group C/D/F/G/H', '2026-06-30T21:00:00Z', 'MetLife Stadium, East Rutherford'),
  ('r32', null, 'Winner Group A', '3rd Group C/E/F/H/I', '2026-07-01T01:00:00Z', 'Estadio Azteca, Mexico City'),
  ('r32', null, 'Winner Group L', '3rd Group E/H/I/J/K', '2026-07-01T16:00:00Z', 'Mercedes-Benz Stadium, Atlanta'),
  ('r32', null, 'Winner Group G', '3rd Group A/E/H/I/J', '2026-07-01T20:00:00Z', 'Lumen Field, Seattle'),
  ('r32', null, 'Winner Group D', '3rd Group B/E/F/I/J', '2026-07-02T00:00:00Z', 'Levi''s Stadium, Santa Clara'),
  ('r32', null, 'Winner Group H', '2nd Group J', '2026-07-02T19:00:00Z', 'SoFi Stadium, Inglewood'),
  ('r32', null, '2nd Group K', '2nd Group L', '2026-07-02T23:00:00Z', 'BMO Field, Toronto'),
  ('r32', null, 'Winner Group B', '3rd Group E/F/G/I/J', '2026-07-03T03:00:00Z', 'BC Place, Vancouver'),
  ('r32', null, '2nd Group D', '2nd Group G', '2026-07-03T18:00:00Z', 'AT&T Stadium, Arlington'),
  ('r32', null, 'Winner Group J', '2nd Group H', '2026-07-03T22:00:00Z', 'Hard Rock Stadium, Miami Gardens'),
  ('r32', null, 'Winner Group K', '3rd Group D/E/I/J/L', '2026-07-04T01:30:00Z', 'Arrowhead Stadium, Kansas City'),
  ('r16', null, 'Winner Match 73', 'Winner Match 75', '2026-07-04T17:00:00Z', 'NRG Stadium, Houston'),
  ('r16', null, 'Winner Match 74', 'Winner Match 77', '2026-07-04T21:00:00Z', 'Lincoln Financial Field, Philadelphia'),
  ('r16', null, 'Winner Match 76', 'Winner Match 78', '2026-07-05T20:00:00Z', 'MetLife Stadium, East Rutherford'),
  ('r16', null, 'Winner Match 79', 'Winner Match 80', '2026-07-06T00:00:00Z', 'Estadio Azteca, Mexico City'),
  ('r16', null, 'Winner Match 83', 'Winner Match 84', '2026-07-06T19:00:00Z', 'AT&T Stadium, Arlington'),
  ('r16', null, 'Winner Match 81', 'Winner Match 82', '2026-07-07T00:00:00Z', 'Lumen Field, Seattle'),
  ('r16', null, 'Winner Match 86', 'Winner Match 88', '2026-07-07T16:00:00Z', 'Mercedes-Benz Stadium, Atlanta'),
  ('r16', null, 'Winner Match 85', 'Winner Match 87', '2026-07-07T20:00:00Z', 'BC Place, Vancouver'),
  ('qf', null, 'Winner Match 89', 'Winner Match 90', '2026-07-09T20:00:00Z', 'Gillette Stadium, Foxborough'),
  ('qf', null, 'Winner Match 93', 'Winner Match 94', '2026-07-10T19:00:00Z', 'SoFi Stadium, Inglewood'),
  ('qf', null, 'Winner Match 91', 'Winner Match 92', '2026-07-11T21:00:00Z', 'Hard Rock Stadium, Miami Gardens'),
  ('qf', null, 'Winner Match 95', 'Winner Match 96', '2026-07-12T01:00:00Z', 'Arrowhead Stadium, Kansas City'),
  ('sf', null, 'Winner Match 97', 'Winner Match 98', '2026-07-14T19:00:00Z', 'AT&T Stadium, Arlington'),
  ('sf', null, 'Winner Match 99', 'Winner Match 100', '2026-07-15T19:00:00Z', 'Mercedes-Benz Stadium, Atlanta'),
  ('third', null, 'Loser Match 101', 'Loser Match 102', '2026-07-18T21:00:00Z', 'Hard Rock Stadium, Miami Gardens'),
  ('final', null, 'Winner Match 101', 'Winner Match 102', '2026-07-19T19:00:00Z', 'MetLife Stadium, East Rutherford');

do $$
declare
  c int;
begin
  select count(*) into c from public.matches;
  if c <> 104 then
    raise exception 'matches seed: expected 104 rows, got %', c;
  end if;
end $$;

commit;
