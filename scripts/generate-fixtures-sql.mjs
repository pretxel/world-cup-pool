// Generate supabase/seed/matches.sql from the canonical fixture list collected
// from Wikipedia (per-group articles + the knockout article). Each raw row is
// "stage|label_or_letter|home|away|date|time|tz|venue|city" pipe-delimited.
// We override the per-row tz with a canonical venue → IANA timezone so the
// conversion is correct even if the source page used the wrong zone string
// (e.g. NRG Stadium in Houston was sometimes labelled America/New_York).
//
// Run:
//   node scripts/generate-fixtures-sql.mjs > supabase/seed/matches.sql

// June/July 2026 UTC offsets (Mexico has no DST since 2022 for these cities).
const VENUE_TZ_OFFSET = {
  "Estadio Azteca": -6, // Mexico City
  "Estadio Akron": -6, // Zapopan / Guadalajara
  "Estadio BBVA": -6, // Guadalupe / Monterrey
  "BMO Field": -4, // Toronto, EDT
  "BC Place": -7, // Vancouver, PDT
  "Mercedes-Benz Stadium": -4, // Atlanta, EDT
  "Lincoln Financial Field": -4, // Philadelphia
  "MetLife Stadium": -4, // East Rutherford, NJ
  "Hard Rock Stadium": -4, // Miami Gardens
  "Gillette Stadium": -4, // Foxborough
  "NRG Stadium": -5, // Houston, CDT
  "AT&T Stadium": -5, // Arlington, TX
  "Arrowhead Stadium": -5, // Kansas City
  "SoFi Stadium": -7, // Inglewood, PDT
  "Levi's Stadium": -7, // Santa Clara
  "Lumen Field": -7, // Seattle
};

// Group letter → stage
const groupRows = [
  "A|Mexico|South Africa|2026-06-11|13:00|Estadio Azteca|Mexico City",
  "A|South Korea|Czech Republic|2026-06-11|20:00|Estadio Akron|Zapopan",
  "A|Czech Republic|South Africa|2026-06-18|12:00|Mercedes-Benz Stadium|Atlanta",
  "A|Mexico|South Korea|2026-06-18|19:00|Estadio Akron|Zapopan",
  "A|Czech Republic|Mexico|2026-06-24|19:00|Estadio Azteca|Mexico City",
  "A|South Africa|South Korea|2026-06-24|19:00|Estadio BBVA|Guadalupe",

  "B|Canada|Bosnia and Herzegovina|2026-06-12|15:00|BMO Field|Toronto",
  "B|Qatar|Switzerland|2026-06-13|12:00|Levi's Stadium|Santa Clara",
  "B|Switzerland|Bosnia and Herzegovina|2026-06-18|12:00|SoFi Stadium|Inglewood",
  "B|Canada|Qatar|2026-06-18|15:00|BC Place|Vancouver",
  "B|Switzerland|Canada|2026-06-24|12:00|BC Place|Vancouver",
  "B|Bosnia and Herzegovina|Qatar|2026-06-24|12:00|Lumen Field|Seattle",

  "C|Brazil|Morocco|2026-06-13|18:00|MetLife Stadium|East Rutherford",
  "C|Haiti|Scotland|2026-06-13|21:00|Gillette Stadium|Foxborough",
  "C|Scotland|Morocco|2026-06-19|18:00|Gillette Stadium|Foxborough",
  "C|Brazil|Haiti|2026-06-19|20:30|Lincoln Financial Field|Philadelphia",
  "C|Scotland|Brazil|2026-06-24|18:00|Hard Rock Stadium|Miami Gardens",
  "C|Morocco|Haiti|2026-06-24|18:00|Mercedes-Benz Stadium|Atlanta",

  "D|United States|Paraguay|2026-06-12|18:00|SoFi Stadium|Inglewood",
  "D|Australia|Turkey|2026-06-13|21:00|BC Place|Vancouver",
  "D|United States|Australia|2026-06-19|12:00|Lumen Field|Seattle",
  "D|Turkey|Paraguay|2026-06-19|20:00|Levi's Stadium|Santa Clara",
  "D|Turkey|United States|2026-06-25|19:00|SoFi Stadium|Inglewood",
  "D|Paraguay|Australia|2026-06-25|19:00|Levi's Stadium|Santa Clara",

  "E|Germany|Curaçao|2026-06-14|12:00|NRG Stadium|Houston",
  "E|Ivory Coast|Ecuador|2026-06-14|19:00|Lincoln Financial Field|Philadelphia",
  "E|Germany|Ivory Coast|2026-06-20|16:00|BMO Field|Toronto",
  "E|Ecuador|Curaçao|2026-06-20|19:00|Arrowhead Stadium|Kansas City",
  "E|Curaçao|Ivory Coast|2026-06-25|16:00|Lincoln Financial Field|Philadelphia",
  "E|Ecuador|Germany|2026-06-25|16:00|MetLife Stadium|East Rutherford",

  "F|Netherlands|Japan|2026-06-14|15:00|AT&T Stadium|Arlington",
  "F|Sweden|Tunisia|2026-06-14|20:00|Estadio BBVA|Guadalupe",
  "F|Netherlands|Sweden|2026-06-20|12:00|NRG Stadium|Houston",
  "F|Tunisia|Japan|2026-06-20|22:00|Estadio BBVA|Guadalupe",
  "F|Japan|Sweden|2026-06-25|18:00|AT&T Stadium|Arlington",
  "F|Tunisia|Netherlands|2026-06-25|18:00|Arrowhead Stadium|Kansas City",

  "G|Belgium|Egypt|2026-06-15|12:00|Lumen Field|Seattle",
  "G|Iran|New Zealand|2026-06-15|18:00|SoFi Stadium|Inglewood",
  "G|Belgium|Iran|2026-06-21|12:00|SoFi Stadium|Inglewood",
  "G|New Zealand|Egypt|2026-06-21|18:00|BC Place|Vancouver",
  "G|Egypt|Iran|2026-06-26|20:00|Lumen Field|Seattle",
  "G|New Zealand|Belgium|2026-06-26|20:00|BC Place|Vancouver",

  "H|Spain|Cape Verde|2026-06-15|12:00|Mercedes-Benz Stadium|Atlanta",
  "H|Saudi Arabia|Uruguay|2026-06-15|18:00|Hard Rock Stadium|Miami Gardens",
  "H|Spain|Saudi Arabia|2026-06-21|12:00|Mercedes-Benz Stadium|Atlanta",
  "H|Uruguay|Cape Verde|2026-06-21|18:00|Hard Rock Stadium|Miami Gardens",
  "H|Cape Verde|Saudi Arabia|2026-06-26|19:00|NRG Stadium|Houston",
  "H|Uruguay|Spain|2026-06-26|18:00|Estadio Akron|Zapopan",

  "I|France|Senegal|2026-06-16|15:00|MetLife Stadium|East Rutherford",
  "I|Iraq|Norway|2026-06-16|18:00|Gillette Stadium|Foxborough",
  "I|France|Iraq|2026-06-22|17:00|Lincoln Financial Field|Philadelphia",
  "I|Norway|Senegal|2026-06-22|20:00|MetLife Stadium|East Rutherford",
  "I|Norway|France|2026-06-26|15:00|Gillette Stadium|Foxborough",
  "I|Senegal|Iraq|2026-06-26|15:00|BMO Field|Toronto",

  "J|Argentina|Algeria|2026-06-16|20:00|Arrowhead Stadium|Kansas City",
  "J|Austria|Jordan|2026-06-16|21:00|Levi's Stadium|Santa Clara",
  "J|Argentina|Austria|2026-06-22|12:00|AT&T Stadium|Arlington",
  "J|Jordan|Algeria|2026-06-22|20:00|Levi's Stadium|Santa Clara",
  "J|Algeria|Austria|2026-06-27|21:00|Arrowhead Stadium|Kansas City",
  "J|Jordan|Argentina|2026-06-27|21:00|AT&T Stadium|Arlington",

  "K|Portugal|DR Congo|2026-06-17|12:00|NRG Stadium|Houston",
  "K|Uzbekistan|Colombia|2026-06-17|20:00|Estadio Azteca|Mexico City",
  "K|Portugal|Uzbekistan|2026-06-23|12:00|NRG Stadium|Houston",
  "K|Colombia|DR Congo|2026-06-23|20:00|Estadio Akron|Zapopan",
  "K|Colombia|Portugal|2026-06-27|19:30|Hard Rock Stadium|Miami Gardens",
  "K|DR Congo|Uzbekistan|2026-06-27|19:30|Mercedes-Benz Stadium|Atlanta",

  "L|England|Croatia|2026-06-17|15:00|AT&T Stadium|Arlington",
  "L|Ghana|Panama|2026-06-17|19:00|BMO Field|Toronto",
  "L|England|Ghana|2026-06-23|16:00|Gillette Stadium|Foxborough",
  "L|Panama|Croatia|2026-06-23|19:00|BMO Field|Toronto",
  "L|Panama|England|2026-06-27|17:00|MetLife Stadium|East Rutherford",
  "L|Croatia|Ghana|2026-06-27|17:00|Lincoln Financial Field|Philadelphia",
];

// Knockout rows: stage|home_label|away_label|date|time|venue|city
const knockoutRows = [
  "r32|2nd Group A|2nd Group B|2026-06-28|12:00|SoFi Stadium|Inglewood",
  "r32|Winner Group C|2nd Group F|2026-06-29|12:00|NRG Stadium|Houston",
  "r32|Winner Group E|3rd Group A/B/C/D/F|2026-06-29|16:30|Gillette Stadium|Foxborough",
  "r32|Winner Group F|2nd Group C|2026-06-29|19:00|Estadio BBVA|Guadalupe",
  "r32|2nd Group E|2nd Group I|2026-06-30|12:00|AT&T Stadium|Arlington",
  "r32|Winner Group I|3rd Group C/D/F/G/H|2026-06-30|17:00|MetLife Stadium|East Rutherford",
  "r32|Winner Group A|3rd Group C/E/F/H/I|2026-06-30|19:00|Estadio Azteca|Mexico City",
  "r32|Winner Group L|3rd Group E/H/I/J/K|2026-07-01|12:00|Mercedes-Benz Stadium|Atlanta",
  "r32|Winner Group G|3rd Group A/E/H/I/J|2026-07-01|13:00|Lumen Field|Seattle",
  "r32|Winner Group D|3rd Group B/E/F/I/J|2026-07-01|17:00|Levi's Stadium|Santa Clara",
  "r32|Winner Group H|2nd Group J|2026-07-02|12:00|SoFi Stadium|Inglewood",
  "r32|2nd Group K|2nd Group L|2026-07-02|19:00|BMO Field|Toronto",
  "r32|Winner Group B|3rd Group E/F/G/I/J|2026-07-02|20:00|BC Place|Vancouver",
  "r32|2nd Group D|2nd Group G|2026-07-03|13:00|AT&T Stadium|Arlington",
  "r32|Winner Group J|2nd Group H|2026-07-03|18:00|Hard Rock Stadium|Miami Gardens",
  "r32|Winner Group K|3rd Group D/E/I/J/L|2026-07-03|20:30|Arrowhead Stadium|Kansas City",

  "r16|Winner Match 73|Winner Match 75|2026-07-04|12:00|NRG Stadium|Houston",
  "r16|Winner Match 74|Winner Match 77|2026-07-04|17:00|Lincoln Financial Field|Philadelphia",
  "r16|Winner Match 76|Winner Match 78|2026-07-05|16:00|MetLife Stadium|East Rutherford",
  "r16|Winner Match 79|Winner Match 80|2026-07-05|18:00|Estadio Azteca|Mexico City",
  "r16|Winner Match 83|Winner Match 84|2026-07-06|14:00|AT&T Stadium|Arlington",
  "r16|Winner Match 81|Winner Match 82|2026-07-06|17:00|Lumen Field|Seattle",
  "r16|Winner Match 86|Winner Match 88|2026-07-07|12:00|Mercedes-Benz Stadium|Atlanta",
  "r16|Winner Match 85|Winner Match 87|2026-07-07|13:00|BC Place|Vancouver",

  "qf|Winner Match 89|Winner Match 90|2026-07-09|16:00|Gillette Stadium|Foxborough",
  "qf|Winner Match 93|Winner Match 94|2026-07-10|12:00|SoFi Stadium|Inglewood",
  "qf|Winner Match 91|Winner Match 92|2026-07-11|17:00|Hard Rock Stadium|Miami Gardens",
  "qf|Winner Match 95|Winner Match 96|2026-07-11|20:00|Arrowhead Stadium|Kansas City",

  "sf|Winner Match 97|Winner Match 98|2026-07-14|14:00|AT&T Stadium|Arlington",
  "sf|Winner Match 99|Winner Match 100|2026-07-15|15:00|Mercedes-Benz Stadium|Atlanta",

  "third|Loser Match 101|Loser Match 102|2026-07-18|17:00|Hard Rock Stadium|Miami Gardens",
  "final|Winner Match 101|Winner Match 102|2026-07-19|15:00|MetLife Stadium|East Rutherford",
];

function toUtcIso(date, time, venue) {
  const offset = VENUE_TZ_OFFSET[venue];
  if (offset === undefined) {
    throw new Error(`Missing tz offset for venue: ${venue}`);
  }
  // Local time → UTC: subtract offset hours (offset is negative in the Americas,
  // so subtracting -6 means adding 6).
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const local = Date.UTC(y, m - 1, d, hh - offset, mm);
  return new Date(local).toISOString().replace(".000Z", "Z");
}

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

function buildRow(stage, group, home, away, date, time, venue, city) {
  const utc = toUtcIso(date, time, venue);
  const groupSql = group ? `'${group}'` : "null";
  return `  ('${stage}', ${groupSql}, '${sqlEscape(home)}', '${sqlEscape(away)}', '${utc}', '${sqlEscape(`${venue}, ${city}`)}')`;
}

const valueRows = [];

for (const raw of groupRows) {
  const [group, home, away, date, time, venue, city] = raw.split("|");
  valueRows.push(buildRow("group", group, home, away, date, time, venue, city));
}
for (const raw of knockoutRows) {
  const [stage, home, away, date, time, venue, city] = raw.split("|");
  valueRows.push(buildRow(stage, null, home, away, date, time, venue, city));
}

const sql = `-- ===========================================================================
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

-- Every fixture is stamped with the World Cup 2026 competition id (resolved by
-- slug). matches.competition_id is NOT NULL, so the seeded competition row from
-- 20260614000000_competitions.sql must exist before this seed runs.
insert into public.matches (competition_id, stage, group_code, home_team, away_team, kickoff_at, venue)
select
  (select id from public.competitions where slug = 'world-cup-2026'),
  v.stage, v.group_code, v.home_team, v.away_team, v.kickoff_at::timestamptz, v.venue
from (values
${valueRows.join(",\n")}
) as v(stage, group_code, home_team, away_team, kickoff_at, venue);

do $$
declare
  c int;
begin
  select count(*) into c
  from public.matches m
  join public.competitions comp on comp.id = m.competition_id
  where comp.slug = 'world-cup-2026';
  if c <> 104 then
    raise exception 'matches seed: expected 104 World Cup 2026 rows, got %', c;
  end if;
end $$;

commit;
`;

process.stdout.write(sql);
