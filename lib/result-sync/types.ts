// Shared shapes for the result-sync pipeline. Every provider normalizes its
// payload to RemoteMatch (Football-Data.org's vocabulary) so the matching and
// write logic in core.ts stays provider-agnostic.

export type RemoteMatch = {
  id: number;
  utcDate: string;
  status: string;
  homeTeam?: { name?: string | null } | null;
  awayTeam?: { name?: string | null } | null;
  score?: {
    fullTime?: { home: number | null; away: number | null } | null;
  } | null;
};

export type LocalMatch = {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

export type SyncSource = "football-data" | "espn";

export type RunSummary = {
  fetched: number;
  matched: number;
  live: number;
  final: number;
  recomputed: number;
  unmatched: number;
  errors: number;
  source: SyncSource | "none";
  stale: number;
  staleResolved: number;
};

export interface ResultProvider {
  name: SyncSource;
  // False when the provider's required env vars are absent; such providers are
  // skipped without counting as an error.
  available(): boolean;
  // `dates` (UTC YYYY-MM-DD) scopes the fetch when the provider supports it;
  // providers that always return the full competition may ignore it.
  fetchMatches(dates?: string[]): Promise<RemoteMatch[]>;
}
