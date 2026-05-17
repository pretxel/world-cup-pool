// Maps Football-Data.org's team names to our seed names. Add a row whenever the
// remote feed uses a spelling that doesn't match what's in supabase/seed/matches.sql.
// Anything not in this map passes through unchanged, so the common case is no-op.
export const REMOTE_TO_LOCAL_TEAM: Record<string, string> = {
  USA: "United States",
  "United States of America": "United States",
  "Korea Republic": "South Korea",
  "Republic of Korea": "South Korea",
  "Côte d'Ivoire": "Ivory Coast",
  "Cote d'Ivoire": "Ivory Coast",
  "Czechia": "Czech Republic",
  "Türkiye": "Turkey",
  "Turkiye": "Turkey",
  "Cabo Verde": "Cape Verde",
  "Cape Verde Islands": "Cape Verde",
  "Bosnia-Herzegovina": "Bosnia and Herzegovina",
  "DR Congo": "DR Congo",
  "Congo DR": "DR Congo",
  "Democratic Republic of the Congo": "DR Congo",
  "Curacao": "Curaçao",
};

export function normalizeTeamName(remote: string | null | undefined): string {
  if (!remote) return "";
  const trimmed = remote.trim();
  return REMOTE_TO_LOCAL_TEAM[trimmed] ?? trimmed;
}
