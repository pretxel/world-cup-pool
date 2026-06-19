import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { loadH2HStandings, loadRecentForm } from "@/lib/h2h";

// Minimal fake of the PostgREST chain the helpers use. loadH2HStandings calls
// .from().select().eq().maybeSingle(); loadRecentForm calls
// .from().select().eq().order().limit(). Each `from("...")` pulls the next
// queued result, so tests script results in call order.
type Result = { data: unknown; error?: unknown };

function fakeSupabase(results: Result[]): SupabaseClient<Database> {
  let i = 0;
  const next = () => results[i++] ?? { data: null };
  const from = () => {
    const result = next();
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
    };
    return builder;
  };
  return { from } as unknown as SupabaseClient<Database>;
}

describe("loadH2HStandings", () => {
  it("maps both rows back to the requested a/b order", async () => {
    const supabase = fakeSupabase([
      {
        data: {
          user_id: "u-a",
          rank: 3,
          display_name: "Ada",
          total_points: 47,
          exact_hits: 9,
        },
      },
      {
        data: {
          user_id: "u-b",
          rank: 5,
          display_name: "Bo",
          total_points: 40,
          exact_hits: 6,
        },
      },
    ]);
    const standings = await loadH2HStandings(supabase, "u-a", "u-b");
    expect(standings).not.toBeNull();
    expect(standings!.a).toEqual({
      userId: "u-a",
      displayName: "Ada",
      rank: 3,
      totalPoints: 47,
      exactHits: 9,
    });
    expect(standings!.b.userId).toBe("u-b");
    expect(standings!.b.rank).toBe(5);
  });

  it("returns null when either player is missing", async () => {
    const onlyA = fakeSupabase([
      { data: { user_id: "u-a", rank: 1, display_name: "Ada", total_points: 1, exact_hits: 0 } },
      { data: null },
    ]);
    expect(await loadH2HStandings(onlyA, "u-a", "u-b")).toBeNull();

    const onlyB = fakeSupabase([
      { data: null },
      { data: { user_id: "u-b", rank: 1, display_name: "Bo", total_points: 1, exact_hits: 0 } },
    ]);
    expect(await loadH2HStandings(onlyB, "u-a", "u-b")).toBeNull();
  });

  it("defaults missing numeric fields to 0", async () => {
    const supabase = fakeSupabase([
      {
        data: {
          user_id: "u-a",
          rank: null,
          display_name: null,
          total_points: null,
          exact_hits: null,
        },
      },
      { data: { user_id: "u-b", rank: 2, display_name: "Bo", total_points: 5, exact_hits: 1 } },
    ]);
    const standings = await loadH2HStandings(supabase, "u-a", "u-b");
    expect(standings!.a).toEqual({
      userId: "u-a",
      displayName: null,
      rank: 0,
      totalPoints: 0,
      exactHits: 0,
    });
  });
});

describe("loadRecentForm", () => {
  it("classifies exact/winner_gd/winner as hit and miss as miss, newest first", async () => {
    const supabase = fakeSupabase([
      {
        data: [
          { match_id: "m1", hit_type: "exact", computed_at: "2026-06-19T00:00:00Z" },
          { match_id: "m2", hit_type: "winner_gd", computed_at: "2026-06-18T00:00:00Z" },
          { match_id: "m3", hit_type: "winner", computed_at: "2026-06-17T00:00:00Z" },
          { match_id: "m4", hit_type: "miss", computed_at: "2026-06-16T00:00:00Z" },
        ],
      },
    ]);
    const form = await loadRecentForm(supabase, "u-a");
    expect(form).toEqual([
      { matchId: "m1", outcome: "hit" },
      { matchId: "m2", outcome: "hit" },
      { matchId: "m3", outcome: "hit" },
      { matchId: "m4", outcome: "miss" },
    ]);
  });

  it("returns [] when the player has no scored matches", async () => {
    const supabase = fakeSupabase([{ data: [] }]);
    expect(await loadRecentForm(supabase, "u-a")).toEqual([]);
  });

  it("returns [] (degrades) when the query errors", async () => {
    const supabase = fakeSupabase([{ data: null, error: { message: "boom" } }]);
    expect(await loadRecentForm(supabase, "u-a")).toEqual([]);
  });
});
