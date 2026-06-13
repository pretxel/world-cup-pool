import { describe, expect, it } from "vitest";
import {
  competitionSchema,
  formatConfigSchema,
  getStageLabel,
  getStageOrder,
  groupCodePattern,
  hasGroupStage,
  parseFormatConfig,
  sortedStages,
  type CompetitionFormat,
} from "@/lib/competition-schema";

// World Cup 2026 format — the exact shape seeded by the M2 migration.
const WC_FORMAT = {
  stages: [
    { key: "group", kind: "group", order: 1, hasGroupCode: true, labels: { en: "Group stage", es: "Fase de grupos", fr: "Phase de groupes" } },
    { key: "r16", kind: "knockout", order: 3, hasGroupCode: false, labels: { en: "Round of 16" } },
    { key: "final", kind: "knockout", order: 7, hasGroupCode: false, labels: { en: "Final" } },
  ],
  groups: { enabled: true, pattern: "^[A-L]$", count: 12 },
};

// Champions League "Swiss" league phase — single league stage, no groups.
const LEAGUE_FORMAT = {
  stages: [
    { key: "league", kind: "league", order: 1, hasGroupCode: false, labels: { en: "League phase" } },
    { key: "final", kind: "knockout", order: 2, hasGroupCode: false, labels: { en: "Final" } },
  ],
  groups: { enabled: false },
};

describe("formatConfigSchema", () => {
  it("accepts a group + knockout format", () => {
    expect(formatConfigSchema.safeParse(WC_FORMAT).success).toBe(true);
  });

  it("accepts a league-only format with groups disabled", () => {
    expect(formatConfigSchema.safeParse(LEAGUE_FORMAT).success).toBe(true);
  });

  it("rejects an empty stages array", () => {
    const r = formatConfigSchema.safeParse({ stages: [], groups: { enabled: false } });
    expect(r.success).toBe(false);
  });

  it("rejects duplicate stage keys", () => {
    const r = formatConfigSchema.safeParse({
      stages: [
        { key: "final", kind: "knockout", order: 1, labels: { en: "A" } },
        { key: "final", kind: "knockout", order: 2, labels: { en: "B" } },
      ],
      groups: { enabled: false },
    });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid stage kind", () => {
    const r = formatConfigSchema.safeParse({
      stages: [{ key: "x", kind: "bogus", order: 1, labels: { en: "X" } }],
      groups: { enabled: false },
    });
    expect(r.success).toBe(false);
  });

  it("rejects hasGroupCode when groups are disabled", () => {
    const r = formatConfigSchema.safeParse({
      stages: [{ key: "group", kind: "group", order: 1, hasGroupCode: true, labels: { en: "G" } }],
      groups: { enabled: false },
    });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid group regex", () => {
    const r = formatConfigSchema.safeParse({
      stages: [{ key: "group", kind: "group", order: 1, hasGroupCode: true, labels: { en: "G" } }],
      groups: { enabled: true, pattern: "[A-", count: 4 },
    });
    expect(r.success).toBe(false);
  });

  it("requires the default locale label", () => {
    const r = formatConfigSchema.safeParse({
      stages: [{ key: "final", kind: "knockout", order: 1, labels: { es: "Final" } }],
      groups: { enabled: false },
    });
    expect(r.success).toBe(false);
  });
});

describe("format helpers", () => {
  const wc: CompetitionFormat = parseFormatConfig(WC_FORMAT);

  it("sorts stages by order", () => {
    expect(sortedStages(wc).map((s) => s.key)).toEqual(["group", "r16", "final"]);
  });

  it("resolves a localized stage label with fallback", () => {
    expect(getStageLabel(wc, "group", "fr")).toBe("Phase de groupes");
    expect(getStageLabel(wc, "r16", "fr")).toBe("Round of 16"); // falls back to en
    expect(getStageLabel(wc, "unknown", "en")).toBe("unknown"); // falls back to key
  });

  it("reads stage order", () => {
    expect(getStageOrder(wc, "final")).toBe(7);
  });

  it("reports group-stage presence and pattern", () => {
    expect(hasGroupStage(wc)).toBe(true);
    expect(groupCodePattern(wc)).toBe("^[A-L]$");
    const league = parseFormatConfig(LEAGUE_FORMAT);
    expect(hasGroupStage(league)).toBe(false);
    expect(groupCodePattern(league)).toBeNull();
  });
});

describe("competitionSchema", () => {
  it("accepts a valid competition input", () => {
    const r = competitionSchema.safeParse({
      slug: "world-cup-2026",
      kind: "world_cup",
      name: "FIFA World Cup 2026",
      short_name: "World Cup 2026",
      tournament_start_at: "2026-06-11T19:00:00Z",
      format_config: WC_FORMAT,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-kebab slug", () => {
    const r = competitionSchema.safeParse({
      slug: "World Cup 2026",
      kind: "world_cup",
      name: "x",
      short_name: "x",
      tournament_start_at: "2026-06-11T19:00:00Z",
      format_config: WC_FORMAT,
    });
    expect(r.success).toBe(false);
  });
});
