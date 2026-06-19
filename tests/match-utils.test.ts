import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dayKeyForTimeZone,
  filterableTeams,
  formatDayKeyLabel,
  isConfirmedMatch,
  isLocked,
  isValidTimeZone,
  localDateKey,
  lockReason,
  matchInvolvesTeam,
  needsPick,
  parsePicksParam,
  parseStatusParam,
  parseTeamParam,
  reconcileSelectedTeams,
  soonestPickableMatch,
  statusBucket,
  utcDateKey,
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

describe("parseStatusParam", () => {
  it("returns null for undefined and empty", () => {
    expect(parseStatusParam(undefined)).toBeNull();
    expect(parseStatusParam("")).toBeNull();
  });

  it("accepts the three known buckets, case-insensitively", () => {
    expect(parseStatusParam("upcoming")).toBe("upcoming");
    expect(parseStatusParam("Live")).toBe("live");
    expect(parseStatusParam(" FINAL ")).toBe("final");
  });

  it("returns null for unknown values", () => {
    expect(parseStatusParam("banana")).toBeNull();
    expect(parseStatusParam("cancelled")).toBeNull();
  });

  it("keeps the first recognized value of a repeated param", () => {
    expect(parseStatusParam(["banana", "live", "final"])).toBe("live");
  });
});

describe("parsePicksParam", () => {
  it("is true only for the exact opt-in value", () => {
    expect(parsePicksParam("needed")).toBe(true);
    expect(parsePicksParam(" Needed ")).toBe(true);
  });

  it("is false for undefined, empty, and unknown values", () => {
    expect(parsePicksParam(undefined)).toBe(false);
    expect(parsePicksParam("")).toBe(false);
    expect(parsePicksParam("all")).toBe(false);
  });

  it("uses the first value of a repeated param", () => {
    expect(parsePicksParam(["needed", "nope"])).toBe(true);
    expect(parsePicksParam(["nope", "needed"])).toBe(false);
  });
});

describe("statusBucket", () => {
  it("buckets live, final, and cancelled by status", () => {
    expect(statusBucket({ status: "live", kickoff_at: FUTURE })).toBe("live");
    expect(statusBucket({ status: "final", kickoff_at: PAST })).toBe("final");
    expect(statusBucket({ status: "cancelled", kickoff_at: FUTURE })).toBe(
      "cancelled",
    );
  });

  it("buckets scheduled matches as upcoming whether locked or not", () => {
    expect(statusBucket({ status: "scheduled", kickoff_at: FUTURE })).toBe(
      "upcoming",
    );
    expect(statusBucket({ status: "scheduled", kickoff_at: PAST })).toBe(
      "upcoming",
    );
  });
});

describe("needsPick", () => {
  const open = { id: "m1", status: "scheduled", kickoff_at: FUTURE };
  const lockedUnpicked = { id: "m2", status: "scheduled", kickoff_at: PAST };
  const live = { id: "m3", status: "live", kickoff_at: PAST };

  it("is true for an unpicked open match", () => {
    expect(needsPick(open, new Set())).toBe(true);
  });

  it("is false once the match is picked", () => {
    expect(needsPick(open, new Set(["m1"]))).toBe(false);
  });

  it("excludes locked and live unpicked matches", () => {
    expect(needsPick(lockedUnpicked, new Set())).toBe(false);
    expect(needsPick(live, new Set())).toBe(false);
  });
});

describe("soonestPickableMatch", () => {
  const m = (id: string, status: string, kickoff_at: string) => ({
    id,
    status,
    kickoff_at,
  });

  it("returns the first open match in a kickoff-ASC list", () => {
    const list = [m("a", "scheduled", FUTURE), m("b", "scheduled", FUTURE)];
    expect(soonestPickableMatch(list, new Set())?.id).toBe("a");
  });

  it("skips leading locked, live, and final matches", () => {
    const list = [
      m("locked", "scheduled", PAST),
      m("live", "live", PAST),
      m("final", "final", PAST),
      m("open", "scheduled", FUTURE),
    ];
    expect(soonestPickableMatch(list, new Set())?.id).toBe("open");
  });

  it("skips already-picked matches", () => {
    const list = [m("picked", "scheduled", FUTURE), m("open", "scheduled", FUTURE)];
    expect(soonestPickableMatch(list, new Set(["picked"]))?.id).toBe("open");
  });

  it("returns null when every match is locked/live/final", () => {
    const list = [
      m("locked", "scheduled", PAST),
      m("live", "live", PAST),
      m("final", "final", PAST),
    ];
    expect(soonestPickableMatch(list, new Set())).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(soonestPickableMatch([], new Set())).toBeNull();
  });
});

describe("isConfirmedMatch", () => {
  it("is true when both teams are real countries", () => {
    expect(isConfirmedMatch(team("Brazil", "Mexico"))).toBe(true);
  });

  it("is false when one side is a knockout placeholder", () => {
    expect(isConfirmedMatch(team("Spain", "Winner Match 73"))).toBe(false);
    expect(isConfirmedMatch(team("2nd Group A", "Croatia"))).toBe(false);
  });

  it("is false when both sides are placeholders", () => {
    expect(isConfirmedMatch(team("2nd Group A", "2nd Group B"))).toBe(false);
  });
});

describe("isValidTimeZone", () => {
  it("accepts real IANA zones", () => {
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Asia/Tokyo")).toBe(true);
  });

  it("rejects empty and garbage values", () => {
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("not-a-zone")).toBe(false);
    expect(isValidTimeZone("America/Atlantis")).toBe(false);
  });
});

describe("localDateKey", () => {
  it("buckets a late UTC instant to the previous local day for a negative-offset zone", () => {
    // 02:00 UTC on the 13th = 19:00 on the 12th in Los Angeles (UTC-7 in June).
    expect(localDateKey("2026-06-13T02:00:00Z", "America/Los_Angeles")).toBe(
      "2026-06-12",
    );
  });

  it("buckets an early UTC instant to the next local day for a positive-offset zone", () => {
    // 22:00 UTC on the 12th = 07:00 on the 13th in Tokyo (UTC+9).
    expect(localDateKey("2026-06-12T22:00:00Z", "Asia/Tokyo")).toBe(
      "2026-06-13",
    );
  });

  it("matches the UTC key when grouping in UTC", () => {
    expect(localDateKey("2026-06-13T02:00:00Z", "UTC")).toBe(
      utcDateKey("2026-06-13T02:00:00Z"),
    );
  });

  it("handles a spring-forward DST boundary without shifting the wrong way", () => {
    // US DST begins 2026-03-08 02:00 local. An instant just after midnight
    // local that day stays on the 8th in Los Angeles.
    expect(localDateKey("2026-03-08T09:30:00Z", "America/Los_Angeles")).toBe(
      "2026-03-08",
    );
  });
});

describe("dayKeyForTimeZone", () => {
  it("returns a local-day keyer for a valid timezone", () => {
    const key = dayKeyForTimeZone("America/Los_Angeles");
    expect(key("2026-06-13T02:00:00Z")).toBe("2026-06-12");
  });

  it("falls back to UTC for a missing timezone", () => {
    const key = dayKeyForTimeZone(null);
    expect(key("2026-06-13T02:00:00Z")).toBe("2026-06-13");
    expect(key).toBe(utcDateKey);
  });

  it("falls back to UTC for an invalid timezone without throwing", () => {
    const key = dayKeyForTimeZone("not-a-zone");
    expect(key("2026-06-13T02:00:00Z")).toBe("2026-06-13");
    expect(key).toBe(utcDateKey);
  });
});

describe("formatDayKeyLabel", () => {
  it("renders the day-key date with no timezone shift", () => {
    // Must read 12, not 11 — i.e. the key's own calendar date, not a value
    // pulled back across UTC midnight.
    const label = formatDayKeyLabel("2026-06-12", "en");
    expect(label).toContain("12");
    expect(label).toContain("Jun");
    expect(label).toContain("2026");
    expect(label).not.toContain("11");
  });

  it("localizes the heading", () => {
    expect(formatDayKeyLabel("2026-06-12", "es")).toContain("jun");
  });
});
