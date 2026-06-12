import { env } from "@/lib/env";
import type { RemoteMatch, ResultProvider } from "@/lib/result-sync/types";

const FOOTBALL_DATA_URL =
  "https://api.football-data.org/v4/competitions/WC/matches?season=2026";

// Primary source. One request returns the whole competition, so the `dates`
// hint is ignored — scoping happens in the matching pipeline.
export const footballDataProvider: ResultProvider = {
  name: "football-data",

  available() {
    return env.footballDataToken != null;
  },

  async fetchMatches(): Promise<RemoteMatch[]> {
    if (!env.footballDataToken) return [];
    const resp = await fetch(FOOTBALL_DATA_URL, {
      headers: { "X-Auth-Token": env.footballDataToken },
      // No Next caching for sync sources.
      cache: "no-store",
    });
    if (!resp.ok) {
      throw new Error(
        `Football-Data fetch failed: ${resp.status} ${resp.statusText}`,
      );
    }
    const body = (await resp.json()) as { matches?: RemoteMatch[] };
    return body.matches ?? [];
  },
};
