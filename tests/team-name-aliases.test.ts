import { describe, expect, it } from "vitest";
import {
  REMOTE_TO_LOCAL_TEAM,
  normalizeTeamName,
} from "@/lib/team-name-aliases";

describe("normalizeTeamName", () => {
  it("maps every alias to its local name", () => {
    for (const [remote, local] of Object.entries(REMOTE_TO_LOCAL_TEAM)) {
      expect(normalizeTeamName(remote)).toBe(local);
    }
  });

  it("passes through names that aren't aliased", () => {
    expect(normalizeTeamName("Mexico")).toBe("Mexico");
    expect(normalizeTeamName("Argentina")).toBe("Argentina");
    expect(normalizeTeamName("England")).toBe("England");
  });

  it("trims whitespace", () => {
    expect(normalizeTeamName("  Brazil  ")).toBe("Brazil");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(normalizeTeamName(null)).toBe("");
    expect(normalizeTeamName(undefined)).toBe("");
    expect(normalizeTeamName("")).toBe("");
  });
});
