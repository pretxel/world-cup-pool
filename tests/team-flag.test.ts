import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TEAM_FLAG, flagSlug } from "@/lib/team-flag";

const SEED_PATH = path.resolve(
  __dirname,
  "..",
  "supabase",
  "seed",
  "matches.sql",
);

const PLACEHOLDER_RE = /^(Winner |Loser |\d+(st|nd|rd|th) |3rd Group|Group [A-L])/;

function looksLikeCountry(name: string): boolean {
  if (PLACEHOLDER_RE.test(name)) return false;
  if (/Group/i.test(name)) return false;
  if (/^[0-9]/.test(name)) return false;
  return true;
}

describe("flagSlug", () => {
  it("returns the mapped ISO for every entry in TEAM_FLAG", () => {
    for (const [team, expected] of Object.entries(TEAM_FLAG)) {
      expect(flagSlug(team)).toBe(expected);
    }
  });

  it("returns 'gb-eng' for England", () => {
    expect(flagSlug("England")).toBe("gb-eng");
  });

  it("returns 'gb-sct' for Scotland", () => {
    expect(flagSlug("Scotland")).toBe("gb-sct");
  });

  it("returns null for knockout placeholders", () => {
    expect(flagSlug("2nd Group A")).toBeNull();
    expect(flagSlug("3rd Group A/B/C/D/F")).toBeNull();
    expect(flagSlug("Winner R32-1")).toBeNull();
  });

  it("returns null for unknown teams", () => {
    expect(flagSlug("Atlantis")).toBeNull();
    expect(flagSlug("")).toBeNull();
  });
});

describe("TEAM_FLAG mapping completeness", () => {
  const seed = fs.readFileSync(SEED_PATH, "utf8");

  const teams = new Set<string>();
  // Match VALUES (...,'home','away',...) and pull the team strings.
  const valueRowRe = /\(\s*[^)]*\)/g;
  const stringRe = /'((?:[^']|'')+)'/g;

  for (const row of seed.match(valueRowRe) ?? []) {
    const strings: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = stringRe.exec(row)) !== null) {
      strings.push(m[1].replace(/''/g, "'"));
    }
    // Best-effort: any string in the row that looks country-shaped is a team
    // candidate. Filter to ones that pass the country heuristic.
    for (const s of strings) {
      if (looksLikeCountry(s) && /^[A-Z]/.test(s) && s.length < 40) {
        teams.add(s);
      }
    }
  }

  it("seed contains a non-trivial set of team strings", () => {
    expect(teams.size).toBeGreaterThan(0);
  });

  it("every country-shaped team in the seed has a flag slug", () => {
    const missing: string[] = [];
    for (const team of teams) {
      // Skip strings that are venues — they all contain a comma.
      if (team.includes(",")) continue;
      // Skip stage / status / group_code literals.
      if (
        ["group", "r32", "r16", "qf", "sf", "third", "final"].includes(
          team.toLowerCase(),
        )
      )
        continue;
      if (/^[A-L]$/.test(team)) continue;
      if (TEAM_FLAG[team] === undefined) missing.push(team);
    }
    expect(missing).toEqual([]);
  });
});
