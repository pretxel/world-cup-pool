import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  filterableTeams,
  isLocked,
  lockReason,
  matchInvolvesTeam,
  parseTeamParam,
  reconcileSelectedTeams,
} from "@/lib/match-utils";

const FIXED_NOW = new Date("2026-06-15T12:00:00.000Z").getTime();
const FUTURE = new Date("2026-06-15T18:00:00.000Z").toISOString();
const PAST = new Date("2026-06-15T06:00:00.000Z").toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("lockReason", () => {
  it("returns null for a scheduled match before kickoff", () => {
    expect(lockReason({ status: "scheduled", kickoff_at: FUTURE })).toBeNull();
  });

  it("returns 'kickoff' for a scheduled match at/after kickoff", () => {
    expect(lockReason({ status: "scheduled", kickoff_at: PAST })).toBe("kickoff");
  });

  it("returns 'live' regardless of kickoff", () => {
    expect(lockReason({ status: "live", kickoff_at: FUTURE })).toBe("live");
    expect(lockReason({ status: "live", kickoff_at: PAST })).toBe("live");
  });

  it("returns 'final' regardless of kickoff", () => {
    expect(lockReason({ status: "final", kickoff_at: FUTURE })).toBe("final");
    expect(lockReason({ status: "final", kickoff_at: PAST })).toBe("final");
  });

  it("returns 'cancelled' regardless of kickoff", () => {
    expect(lockReason({ status: "cancelled", kickoff_at: FUTURE })).toBe(
      "cancelled",
    );
    expect(lockReason({ status: "cancelled", kickoff_at: PAST })).toBe(
      "cancelled",
    );
  });
});

describe("isLocked", () => {
  it("is false for scheduled + future kickoff", () => {
    expect(isLocked({ status: "scheduled", kickoff_at: FUTURE })).toBe(false);
  });

  it("is true for scheduled + past kickoff", () => {
    expect(isLocked({ status: "scheduled", kickoff_at: PAST })).toBe(true);
  });

  it("is true for live/final/cancelled with future kickoff", () => {
    expect(isLocked({ status: "live", kickoff_at: FUTURE })).toBe(true);
    expect(isLocked({ status: "final", kickoff_at: FUTURE })).toBe(true);
    expect(isLocked({ status: "cancelled", kickoff_at: FUTURE })).toBe(true);
  });
});

const team = (home_team: string, away_team: string) => ({ home_team, away_team });

describe("parseTeamParam", () => {
  it("returns an empty set for undefined", () => {
    expect(parseTeamParam(undefined).size).toBe(0);
  });

  it("case-folds a single value", () => {
    expect([...parseTeamParam("Brazil")]).toEqual(["brazil"]);
  });

  it("splits a comma-separated value", () => {
    expect(parseTeamParam("Brazil,Argentina")).toEqual(
      new Set(["brazil", "argentina"]),
    );
  });

  it("flattens a repeated (array) param", () => {
    expect(parseTeamParam(["Brazil", "Mexico"])).toEqual(
      new Set(["brazil", "mexico"]),
    );
  });

  it("trims whitespace and drops blank segments", () => {
    expect(parseTeamParam(" Brazil , , Argentina,")).toEqual(
      new Set(["brazil", "argentina"]),
    );
  });
});

describe("filterableTeams", () => {
  it("returns distinct country teams sorted alphabetically", () => {
    const list = [
      team("Mexico", "Brazil"),
      team("Argentina", "Brazil"),
    ];
    expect(filterableTeams(list)).toEqual(["Argentina", "Brazil", "Mexico"]);
  });

  it("excludes knockout placeholders with no flag mapping", () => {
    const list = [team("2nd Group A", "1st Group B"), team("Brazil", "1st Group C")];
    expect(filterableTeams(list)).toEqual(["Brazil"]);
  });
});

describe("reconcileSelectedTeams", () => {
  const available = ["Argentina", "Brazil", "Mexico"];

  it("keeps known teams in available order, case-insensitively", () => {
    expect(reconcileSelectedTeams(new Set(["brazil", "argentina"]), available)).toEqual(
      ["Argentina", "Brazil"],
    );
  });

  it("drops unknown values, collapsing an all-unknown selection to empty", () => {
    expect(reconcileSelectedTeams(new Set(["atlantis"]), available)).toEqual([]);
  });
});

describe("matchInvolvesTeam", () => {
  it("matches every fixture when the selection is empty", () => {
    expect(matchInvolvesTeam(team("Brazil", "Mexico"), new Set())).toBe(true);
  });

  it("matches on home or away, case-insensitively", () => {
    const sel = new Set(["brazil"]);
    expect(matchInvolvesTeam(team("Brazil", "Mexico"), sel)).toBe(true);
    expect(matchInvolvesTeam(team("Mexico", "Brazil"), sel)).toBe(true);
  });

  it("returns false when no selected team is in the fixture", () => {
    expect(matchInvolvesTeam(team("Mexico", "Argentina"), new Set(["brazil"]))).toBe(
      false,
    );
  });

  it("matches the union for a multi-team selection", () => {
    const sel = new Set(["brazil", "mexico"]);
    expect(matchInvolvesTeam(team("Brazil", "Spain"), sel)).toBe(true);
    expect(matchInvolvesTeam(team("Mexico", "Spain"), sel)).toBe(true);
    expect(matchInvolvesTeam(team("Spain", "France"), sel)).toBe(false);
  });
});
