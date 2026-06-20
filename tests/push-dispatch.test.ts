import { beforeEach, describe, expect, it, vi } from "vitest";
import { filterPushOptIns } from "@/lib/notifications/push-dispatch";

// ---------------------------------------------------------------------------
// filterPushOptIns — pure opt-in gate
// ---------------------------------------------------------------------------
describe("filterPushOptIns", () => {
  it("drops only users whose push pref is explicitly false", () => {
    const result = filterPushOptIns(["a", "b", "c"], [
      { user_id: "a", email_prefs: { push: false } },
      { user_id: "b", email_prefs: { push: true } },
      // c has no pref row at all → treated as opted-in
    ]);
    expect(result).toEqual(["b", "c"]);
  });

  it("treats missing/null/non-boolean push as opted-in", () => {
    const result = filterPushOptIns(["a", "b", "c", "d"], [
      { user_id: "a", email_prefs: {} },
      { user_id: "b", email_prefs: null },
      { user_id: "c", email_prefs: { push: "yes" } },
      { user_id: "d", email_prefs: { push: 1 } },
    ]);
    expect(result).toEqual(["a", "b", "c", "d"]);
  });
});

// ---------------------------------------------------------------------------
// dispatchPushTargets — opt-in filter, prune-on-expired, ledger-on-delivery
// ---------------------------------------------------------------------------
const sendWebPush = vi.fn();
vi.mock("@/lib/notifications/web-push", () => ({
  sendWebPush: (...args: unknown[]) => sendWebPush(...args),
  isWebPushConfigured: () => true,
}));

// A tiny fake of the admin Supabase client covering exactly the calls
// dispatchPushTargets makes: profiles select-in (prefs), push_subscriptions
// select-in (subs), and push_subscriptions delete-in (prune).
function makeAdmin(opts: {
  prefs: { id: string; email_prefs: unknown }[];
  subs: { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }[];
  onDelete?: (ids: string[]) => void;
}) {
  return {
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            in: async () => ({ data: opts.prefs, error: null }),
          }),
        };
      }
      if (table === "push_subscriptions") {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                range: async (start: number) =>
                  start === 0
                    ? { data: opts.subs, error: null }
                    : { data: [], error: null },
              }),
            }),
          }),
          delete: () => ({
            in: async (_col: string, ids: string[]) => {
              opts.onDelete?.(ids);
              return { error: null };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as never;
}

describe("dispatchPushTargets", () => {
  beforeEach(() => sendWebPush.mockReset());

  it("skips opted-out users and writes no ledger for them", async () => {
    const { dispatchPushTargets } = await import("@/lib/notifications/push-dispatch");
    sendWebPush.mockResolvedValue({ status: "sent" });
    const ledger: string[] = [];
    const admin = makeAdmin({
      prefs: [{ id: "out", email_prefs: { push: false } }, { id: "in", email_prefs: {} }],
      subs: [{ id: "s1", user_id: "in", endpoint: "e", p256dh: "p", auth: "a" }],
    });

    const summary = await dispatchPushTargets(
      admin,
      [
        { userId: "out", payload: { title: "t", body: "b", url: "/" } },
        { userId: "in", payload: { title: "t", body: "b", url: "/" } },
      ],
      async (userId) => {
        ledger.push(userId);
      },
    );

    expect(summary.pushed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(ledger).toEqual(["in"]);
  });

  it("prunes a subscription that returns expired and does not write the ledger", async () => {
    const { dispatchPushTargets } = await import("@/lib/notifications/push-dispatch");
    sendWebPush.mockResolvedValue({ status: "expired", statusCode: 410 });
    const ledger: string[] = [];
    const pruned: string[] = [];
    const admin = makeAdmin({
      prefs: [{ id: "u", email_prefs: {} }],
      subs: [{ id: "dead", user_id: "u", endpoint: "e", p256dh: "p", auth: "a" }],
      onDelete: (ids) => pruned.push(...ids),
    });

    const summary = await dispatchPushTargets(
      admin,
      [{ userId: "u", payload: { title: "t", body: "b", url: "/" } }],
      async (userId) => {
        ledger.push(userId);
      },
    );

    expect(pruned).toEqual(["dead"]);
    expect(summary.pruned).toBe(1);
    expect(summary.pushed).toBe(0);
    expect(ledger).toEqual([]); // no delivery → no idempotency stamp
  });

  it("writes the ledger exactly once on delivery (idempotency stamp)", async () => {
    const { dispatchPushTargets } = await import("@/lib/notifications/push-dispatch");
    sendWebPush.mockResolvedValue({ status: "sent" });
    const ledger: string[] = [];
    const admin = makeAdmin({
      prefs: [{ id: "u", email_prefs: {} }],
      subs: [
        { id: "s1", user_id: "u", endpoint: "e1", p256dh: "p", auth: "a" },
        { id: "s2", user_id: "u", endpoint: "e2", p256dh: "p", auth: "a" },
      ],
    });

    const summary = await dispatchPushTargets(
      admin,
      [{ userId: "u", payload: { title: "t", body: "b", url: "/" } }],
      async (userId) => {
        ledger.push(userId);
      },
    );

    // Two browsers, one user → one push counted, one ledger stamp.
    expect(summary.pushed).toBe(1);
    expect(ledger).toEqual(["u"]);
    expect(sendWebPush).toHaveBeenCalledTimes(2);
  });
});
