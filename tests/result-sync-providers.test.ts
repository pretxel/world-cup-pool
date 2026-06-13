import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderConfig } from "@/lib/result-sync/types";

vi.mock("@/lib/env", () => ({
  env: { footballDataToken: "test-token" },
}));

let lastUrl = "";

beforeEach(() => {
  lastUrl = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      lastUrl = url;
      return new Response(JSON.stringify({ matches: [], events: [] }), {
        status: 200,
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("footballDataProvider URL construction", () => {
  it("defaults to the World Cup competition + season", async () => {
    const { footballDataProvider } = await import(
      "@/lib/result-sync/providers/football-data"
    );
    await footballDataProvider.fetchMatches();
    expect(lastUrl).toBe(
      "https://api.football-data.org/v4/competitions/WC/matches?season=2026",
    );
  });

  it("builds the URL from the competition's provider config", async () => {
    const { footballDataProvider } = await import(
      "@/lib/result-sync/providers/football-data"
    );
    const config: ProviderConfig = { footballData: { code: "CL", season: "2027" } };
    await footballDataProvider.fetchMatches(undefined, config);
    expect(lastUrl).toBe(
      "https://api.football-data.org/v4/competitions/CL/matches?season=2027",
    );
  });
});

describe("espnProvider URL construction", () => {
  it("defaults to the fifa.world league path", async () => {
    const { espnProvider } = await import("@/lib/result-sync/providers/espn");
    await espnProvider.fetchMatches(["2026-06-12"]);
    expect(lastUrl).toContain("/soccer/fifa.world/scoreboard");
  });

  it("uses the competition's ESPN league path", async () => {
    const { espnProvider } = await import("@/lib/result-sync/providers/espn");
    await espnProvider.fetchMatches(["2027-09-16"], {
      espn: { leaguePath: "uefa.champions" },
    });
    expect(lastUrl).toContain("/soccer/uefa.champions/scoreboard");
  });

  it("returns empty without fetching when no dates are given", async () => {
    const { espnProvider } = await import("@/lib/result-sync/providers/espn");
    const out = await espnProvider.fetchMatches([]);
    expect(out).toEqual([]);
    expect(lastUrl).toBe("");
  });
});
