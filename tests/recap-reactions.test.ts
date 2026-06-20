import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  REACTION_TYPES,
  buildReactionSummary,
  emptyCounts,
  foldCounts,
  isReactionType,
  sumCounts,
} from "@/lib/recap-reactions";

// The reaction guarantees are enforced structurally in SQL (uniqueness,
// allowlist, active/final scoping, own-row RLS, scoring isolation, rate limit),
// so — with no live Postgres in the test env — we assert the migration encodes
// each load-bearing invariant from the spec, then unit-test the pure helpers the
// page/bar/action share.

const raw = readFileSync(
  fileURLToPath(
    new URL(
      "../supabase/migrations/20260620020002_recap_reactions.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

// Strip `--` line comments so assertions target executable SQL, not the
// explanatory header (which legitimately names scores when describing the
// scoring-isolation rationale).
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

describe("recap_reactions migration — scoring isolation invariant", () => {
  it("never writes to public.scores", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.scores/i);
    expect(sql).not.toMatch(/update\s+public\.scores/i);
  });

  it("does not touch the scoring function or any leaderboard view", () => {
    expect(sql).not.toMatch(/compute_match_scores/i);
    expect(sql).not.toMatch(/v_leaderboard/i);
    expect(sql).not.toMatch(/predictions/i);
  });
});

describe("recap_reactions migration — anti-inflation uniqueness", () => {
  it("declares unique (user_id, summary_id, reaction)", () => {
    expect(sql).toMatch(
      /unique\s*\(\s*user_id\s*,\s*summary_id\s*,\s*reaction\s*\)/i,
    );
  });
});

describe("recap_reactions migration — allowlist", () => {
  it("constrains reaction to the fixed allowlist via a check", () => {
    expect(sql).toMatch(/reaction\s+text\s+not\s+null/i);
    for (const type of REACTION_TYPES) {
      expect(sql).toContain(`'${type}'`);
    }
    expect(sql).toMatch(/check\s*\(\s*reaction\s+in\s*\(/i);
  });

  it("re-checks the allowlist server-side in the toggle function", () => {
    expect(sql).toMatch(/reaction not in/i);
    expect(sql).toMatch(/reaction not allowed/i);
  });
});

describe("recap_reactions migration — RLS own-row + active/final scoping", () => {
  it("enables row level security", () => {
    expect(sql).toMatch(
      /alter table public\.recap_reactions enable row level security/i,
    );
  });

  it("scopes select/insert/delete to the owner (auth.uid())", () => {
    expect(sql).toMatch(/recap_reactions_select_own/i);
    expect(sql).toMatch(/recap_reactions_insert_own_active_final/i);
    expect(sql).toMatch(/recap_reactions_delete_own/i);
    // own-row guards present for each.
    const uidGuards = sql.match(/user_id\s*=\s*auth\.uid\(\)/gi) ?? [];
    expect(uidGuards.length).toBeGreaterThanOrEqual(3);
  });

  it("gates inserts to the active version of a final match", () => {
    expect(sql).toMatch(/s\.is_active/i);
    expect(sql).toMatch(/m\.status\s*=\s*'final'/i);
  });

  it("re-asserts active/final scope in the toggle function", () => {
    expect(sql).toMatch(/recap not reactable/i);
  });
});

describe("recap_reactions migration — public counts view", () => {
  it("exposes counts only for active-version rows, granted to anon", () => {
    expect(sql).toMatch(/create or replace view public\.v_recap_reaction_counts/i);
    expect(sql).toMatch(/security_invoker\s*=\s*off/i);
    expect(sql).toMatch(
      /grant select on public\.v_recap_reaction_counts to anon, authenticated/i,
    );
  });
});

describe("recap_reactions migration — rate limit", () => {
  it("enforces a per-user rolling-window cap in the definer function", () => {
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = public/i);
    expect(sql).toMatch(/rate limit exceeded/i);
    expect(sql).toMatch(/created_at\s*>\s*now\(\)\s*-/i);
  });

  it("grants execute on the toggle function to authenticated only", () => {
    expect(sql).toMatch(
      /grant execute on function public\.toggle_recap_reaction\(uuid, text, boolean\) to authenticated/i,
    );
  });
});

describe("isReactionType", () => {
  it("accepts every allowlisted type", () => {
    for (const type of REACTION_TYPES) {
      expect(isReactionType(type)).toBe(true);
    }
  });

  it("rejects unknown / non-string values", () => {
    expect(isReactionType("spam")).toBe(false);
    expect(isReactionType(null)).toBe(false);
    expect(isReactionType(123)).toBe(false);
    expect(isReactionType(undefined)).toBe(false);
  });
});

describe("foldCounts", () => {
  it("maps allowlisted rows into a complete counts record", () => {
    const counts = foldCounts([
      { reaction: "fire", count: 3 },
      { reaction: "goal", count: 1 },
    ]);
    expect(counts.fire).toBe(3);
    expect(counts.goal).toBe(1);
    expect(counts.sad).toBe(0);
  });

  it("ignores unknown reactions and null counts (stale-client safe)", () => {
    const counts = foldCounts([
      { reaction: "spam", count: 99 },
      { reaction: "fire", count: null },
      { reaction: null, count: 5 },
    ]);
    expect(counts).toEqual(emptyCounts());
  });
});

describe("buildReactionSummary", () => {
  it("dedupes the viewer's own types, filters the allowlist, and totals", () => {
    const summary = buildReactionSummary(
      [
        { reaction: "fire", count: 4 },
        { reaction: "clap", count: 2 },
      ],
      [
        { reaction: "fire" },
        { reaction: "fire" },
        { reaction: "spam" },
        { reaction: null },
      ],
    );
    expect(summary.mine).toEqual(["fire"]);
    expect(summary.total).toBe(6);
    expect(sumCounts(summary.counts)).toBe(6);
  });

  it("yields an all-zero summary with no rows", () => {
    const summary = buildReactionSummary([], []);
    expect(summary.total).toBe(0);
    expect(summary.mine).toEqual([]);
    expect(summary.counts).toEqual(emptyCounts());
  });
});
