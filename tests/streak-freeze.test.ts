import { describe, expect, it } from "vitest";
import {
  currentFreezeWeekBounds,
  detectEligibleGapDay,
  resolveStreakFreeze,
  WEEKLY_FREEZE_ALLOWANCE,
} from "@/lib/streak-freeze";

// Fixed "now": Saturday 2026-06-06T12:00:00Z. Monday-anchored UTC week is
// [2026-06-01, 2026-06-08).
const NOW = new Date("2026-06-06T12:00:00Z");

describe("currentFreezeWeekBounds", () => {
  it("anchors on Monday 00:00:00 UTC", () => {
    const { start, end } = currentFreezeWeekBounds(NOW);
    expect(start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-08T00:00:00.000Z");
  });
});

describe("detectEligibleGapDay", () => {
  it("returns the missed day of a single isolated gap", () => {
    // activity on 06 (today) and 04, missing 05 → 05 is bridgeable
    expect(
      detectEligibleGapDay(new Set(["2026-06-06", "2026-06-04"]), NOW),
    ).toBe("2026-06-05");
  });

  it("returns null when the run is unbroken (no gap)", () => {
    expect(
      detectEligibleGapDay(
        new Set(["2026-06-06", "2026-06-05", "2026-06-04"]),
        NOW,
      ),
    ).toBeNull();
  });

  it("returns null for a two-day gap (not a single isolated gap)", () => {
    // activity on 06 and 03, missing 05 and 04 → not bridgeable by one freeze
    expect(
      detectEligibleGapDay(new Set(["2026-06-06", "2026-06-03"]), NOW),
    ).toBeNull();
  });

  it("returns null when there is no activity (nothing to protect)", () => {
    expect(detectEligibleGapDay(new Set(), NOW)).toBeNull();
  });

  it("returns null when the anchor (today/yesterday) is missing", () => {
    // last activity two days ago → streak already dead, no gap to bridge
    expect(
      detectEligibleGapDay(new Set(["2026-06-04", "2026-06-02"]), NOW),
    ).toBeNull();
  });

  it("does not bridge across the week start when bounded", () => {
    const { start } = currentFreezeWeekBounds(new Date("2026-06-08T12:00:00Z"));
    // Monday today; only today's activity in-week, prior day is last week.
    expect(
      detectEligibleGapDay(
        new Set(["2026-06-08"]),
        new Date("2026-06-08T12:00:00Z"),
        start,
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// In-memory fake of the slice of the Supabase client resolveStreakFreeze uses:
// a streak_freezes table with the two RPCs. Mirrors the SQL semantics (lazy
// grant insert-if-missing, idempotent consume guarded by remaining allowance).
// ---------------------------------------------------------------------------
type Row = {
  user_id: string;
  kind: string;
  row_kind: "grant" | "consumption";
  week_start?: string | null;
  amount?: number | null;
  consumed_day?: string | null;
};

function weekStartKey(now: Date): string {
  return currentFreezeWeekBounds(now).start.toISOString().slice(0, 10);
}

function makeFakeClient(uid: string, now: Date, rows: Row[] = []) {
  const grantRpcCalls: unknown[] = [];
  const consumeRpcCalls: unknown[] = [];

  const client = {
    from() {
      let filtered = rows.slice();
      const builder: Record<string, unknown> = {
        select() {
          return builder;
        },
        eq(col: string, val: unknown) {
          filtered = filtered.filter(
            (r) => (r as Record<string, unknown>)[col] === val,
          );
          return builder;
        },
        in(col: string, vals: unknown[]) {
          filtered = filtered.filter((r) =>
            vals.includes((r as Record<string, unknown>)[col]),
          );
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({ data: filtered[0] ?? null, error: null });
        },
        then(resolve: (v: { data: Row[]; error: null }) => void) {
          resolve({ data: filtered, error: null });
        },
      };
      return builder;
    },
    rpc(fn: string, args: Record<string, unknown>) {
      if (fn === "grant_streak_freeze") {
        grantRpcCalls.push(args);
        const ws = weekStartKey(now);
        const exists = rows.some(
          (r) =>
            r.user_id === uid &&
            r.kind === args.p_kind &&
            r.row_kind === "grant" &&
            r.week_start === ws,
        );
        if (!exists) {
          rows.push({
            user_id: uid,
            kind: args.p_kind as string,
            row_kind: "grant",
            week_start: ws,
            amount: args.p_amount as number,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === "consume_streak_freeze") {
        consumeRpcCalls.push(args);
        const ws = weekStartKey(now);
        const wsDate = new Date(`${ws}T00:00:00Z`);
        const wsEnd = new Date(wsDate);
        wsEnd.setUTCDate(wsEnd.getUTCDate() + 7);
        const already = rows.some(
          (r) =>
            r.user_id === uid &&
            r.kind === args.p_kind &&
            r.row_kind === "consumption" &&
            r.consumed_day === args.p_consumed_day,
        );
        if (already) return Promise.resolve({ data: true, error: null });
        const granted =
          rows.find(
            (r) =>
              r.user_id === uid &&
              r.kind === args.p_kind &&
              r.row_kind === "grant" &&
              r.week_start === ws,
          )?.amount ?? 0;
        const used = rows.filter((r) => {
          if (
            r.user_id !== uid ||
            r.kind !== args.p_kind ||
            r.row_kind !== "consumption" ||
            !r.consumed_day
          )
            return false;
          const d = new Date(`${r.consumed_day}T00:00:00Z`);
          return d >= wsDate && d < wsEnd;
        }).length;
        if (used >= granted) {
          return Promise.resolve({ data: false, error: null });
        }
        rows.push({
          user_id: uid,
          kind: args.p_kind as string,
          row_kind: "consumption",
          consumed_day: args.p_consumed_day as string,
        });
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    _rows: rows,
    _grantRpcCalls: grantRpcCalls,
    _consumeRpcCalls: consumeRpcCalls,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any;
}

describe("resolveStreakFreeze", () => {
  it("anonymous users never consume freezes", async () => {
    const client = makeFakeClient("u1", NOW);
    const state = await resolveStreakFreeze(
      client,
      null,
      "quiz",
      new Set(["2026-06-06", "2026-06-04"]),
      NOW,
    );
    expect(state.frozenDays.size).toBe(0);
    expect(state.remaining).toBe(0);
    expect(client._grantRpcCalls.length).toBe(0);
    expect(client._consumeRpcCalls.length).toBe(0);
  });

  it("consumes one freeze for an eligible gap and is idempotent on re-read", async () => {
    const rows: Row[] = [];
    const activity = new Set(["2026-06-06", "2026-06-04"]); // gap on 05
    const first = await resolveStreakFreeze(
      makeFakeClient("u1", NOW, rows),
      "u1",
      "quiz",
      activity,
      NOW,
    );
    expect(first.frozenDays.has("2026-06-05")).toBe(true);
    expect(first.usedThisWeek).toBe(true);
    expect(first.remaining).toBe(WEEKLY_FREEZE_ALLOWANCE - 1);

    // Re-read with the SAME rows: no additional consumption.
    const consumptionRows = () =>
      rows.filter((r) => r.row_kind === "consumption").length;
    const before = consumptionRows();
    const second = await resolveStreakFreeze(
      makeFakeClient("u1", NOW, rows),
      "u1",
      "quiz",
      activity,
      NOW,
    );
    expect(consumptionRows()).toBe(before);
    expect(second.frozenDays.has("2026-06-05")).toBe(true);
    expect(second.remaining).toBe(WEEKLY_FREEZE_ALLOWANCE - 1);
  });

  it("does not consume when the streak is 0 (no eligible gap)", async () => {
    const rows: Row[] = [];
    const state = await resolveStreakFreeze(
      makeFakeClient("u1", NOW, rows),
      "u1",
      "quiz",
      new Set(), // no activity at all
      NOW,
    );
    expect(state.frozenDays.size).toBe(0);
    expect(rows.filter((r) => r.row_kind === "consumption").length).toBe(0);
    expect(state.remaining).toBe(WEEKLY_FREEZE_ALLOWANCE);
  });

  it("does not consume when no allowance remains", async () => {
    // Pre-seed the grant + a consumption already this week (budget = 1, used 1).
    const ws = weekStartKey(NOW);
    const rows: Row[] = [
      { user_id: "u1", kind: "quiz", row_kind: "grant", week_start: ws, amount: 1 },
      {
        user_id: "u1",
        kind: "quiz",
        row_kind: "consumption",
        consumed_day: "2026-06-02",
      },
    ];
    const before = rows.filter((r) => r.row_kind === "consumption").length;
    const state = await resolveStreakFreeze(
      makeFakeClient("u1", NOW, rows),
      "u1",
      "quiz",
      new Set(["2026-06-06", "2026-06-04"]), // a fresh gap on 05
      NOW,
    );
    // The 05 gap is NOT charged — budget exhausted.
    expect(rows.filter((r) => r.row_kind === "consumption").length).toBe(before);
    expect(state.frozenDays.has("2026-06-05")).toBe(false);
    expect(state.remaining).toBe(0);
  });

  it("keeps quiz and prediction budgets independent", async () => {
    const rows: Row[] = [];
    // Spend the quiz freeze.
    await resolveStreakFreeze(
      makeFakeClient("u1", NOW, rows),
      "u1",
      "quiz",
      new Set(["2026-06-06", "2026-06-04"]),
      NOW,
    );
    // Prediction budget is untouched: a prediction gap still consumes.
    const pred = await resolveStreakFreeze(
      makeFakeClient("u1", NOW, rows),
      "u1",
      "prediction",
      new Set(["2026-06-06", "2026-06-04"]),
      NOW,
      currentFreezeWeekBounds(NOW).start,
    );
    expect(pred.frozenDays.has("2026-06-05")).toBe(true);
    expect(pred.remaining).toBe(WEEKLY_FREEZE_ALLOWANCE - 1);
  });

  it("refills the allowance on a fresh week", async () => {
    // Last week's grant + consumption present; a request in the new week grants
    // a fresh allowance and the remaining count reflects only this week.
    const lastWeekNow = new Date("2026-06-06T12:00:00Z");
    const lastWs = weekStartKey(lastWeekNow);
    const rows: Row[] = [
      {
        user_id: "u1",
        kind: "quiz",
        row_kind: "grant",
        week_start: lastWs,
        amount: 1,
      },
      {
        user_id: "u1",
        kind: "quiz",
        row_kind: "consumption",
        consumed_day: "2026-06-02",
      },
    ];
    const newWeekNow = new Date("2026-06-09T12:00:00Z"); // next week (Tue)
    const state = await resolveStreakFreeze(
      makeFakeClient("u1", newWeekNow, rows),
      "u1",
      "quiz",
      new Set(["2026-06-09"]), // only today, no gap
      newWeekNow,
    );
    // Fresh week: full allowance, prior week's consumption does not count.
    expect(state.remaining).toBe(WEEKLY_FREEZE_ALLOWANCE);
    expect(state.usedThisWeek).toBe(false);
  });
});
