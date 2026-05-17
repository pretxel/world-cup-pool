// Tournament-wide constants. The DB is the truth (see public.matches.kickoff_at
// for the live source), but these values serve as a safety net when the matches
// table is empty (cold dev DB, first deploy, etc.) and as the subhead fallback
// when the opening fixture row doesn't resolve to known countries.

export const TOURNAMENT_START_ISO = "2026-06-11T19:00:00Z";

export const TOURNAMENT_OPENING = {
  home: "Mexico",
  away: "South Africa",
  venue: "Estadio Azteca",
} as const;
