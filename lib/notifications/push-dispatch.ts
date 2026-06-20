import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isOptedIn } from "@/lib/email-prefs";
import {
  sendWebPush,
  type PushPayload,
  type PushSubscriptionRecord,
} from "./web-push";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// PostgREST returns a bounded page; page subscription loads so a large store is
// never silently truncated (mirrors the email loaders).
const SUPABASE_PAGE_LIMIT = 1000;

// Summary returned by every push dispatch step, parallel to the email
// DispatchSummary so the cron can log a count.
export interface PushDispatchSummary {
  pushed: number;
  failed: number;
  pruned: number;
  skipped: number;
}

export const ZERO_PUSH: PushDispatchSummary = {
  pushed: 0,
  failed: 0,
  pruned: 0,
  skipped: 0,
};

// One subscription row, with its id so a 410/404 send can prune exactly it.
interface SubscriptionRow extends PushSubscriptionRecord {
  id: string;
}

// Pure: the subset of `userIds` that is push-opted-in. A player is opted in
// unless their email_prefs.push is explicitly false (isOptedIn semantics), so
// absent/null/non-boolean is treated as opted-in. Exported for unit testing.
export function filterPushOptIns(
  userIds: string[],
  prefs: { user_id: string; email_prefs: unknown }[],
): string[] {
  const optedOut = new Set(
    prefs.filter((p) => !isOptedIn(p.email_prefs, "push")).map((p) => p.user_id),
  );
  return userIds.filter((id) => !optedOut.has(id));
}

// Reads the push preference for the given affected user ids so opted-out
// players can be dropped before any send. Users without a profile row simply
// don't appear (treated as opted-in downstream).
export async function loadPushPrefs(
  admin: AdminClient,
  userIds: string[],
): Promise<{ user_id: string; email_prefs: unknown }[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await admin
    .from("profiles")
    .select("id, email_prefs")
    .in("id", userIds);
  if (error) throw new Error(`[push] load prefs: ${error.message}`);
  return (data ?? []).map((r) => ({
    user_id: r.id as string,
    email_prefs: (r as { email_prefs: unknown }).email_prefs,
  }));
}

// All subscriptions for the given user ids, keyed user_id → rows, paged so a
// large store is never truncated. A player may have several browsers.
export async function loadSubscriptionsByUser(
  admin: AdminClient,
  userIds: string[],
): Promise<Map<string, SubscriptionRow[]>> {
  const byUser = new Map<string, SubscriptionRow[]>();
  if (userIds.length === 0) return byUser;
  for (let offset = 0; ; offset += SUPABASE_PAGE_LIMIT) {
    const { data, error } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", userIds)
      .order("id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_LIMIT - 1);
    if (error) throw new Error(`[push] load subscriptions: ${error.message}`);
    const page = data ?? [];
    for (const r of page) {
      const row: SubscriptionRow = {
        id: r.id as string,
        endpoint: r.endpoint as string,
        p256dh: r.p256dh as string,
        auth: r.auth as string,
      };
      const list = byUser.get(r.user_id as string) ?? [];
      list.push(row);
      byUser.set(r.user_id as string, list);
    }
    if (page.length < SUPABASE_PAGE_LIMIT) break;
  }
  return byUser;
}

// Sends `payload` to every subscription a user has, pruning any endpoint that
// returns 410/404. Returns whether at least one send succeeded (so the caller
// only writes the idempotency ledger on real delivery) plus the prune count.
async function pushToUser(
  admin: AdminClient,
  subs: SubscriptionRow[],
  payload: PushPayload,
): Promise<{ delivered: boolean; pruned: number }> {
  let delivered = false;
  let pruned = 0;
  const deadIds: string[] = [];
  for (const sub of subs) {
    const res = await sendWebPush(sub, payload);
    if (res.status === "sent") {
      delivered = true;
    } else if (res.status === "expired") {
      deadIds.push(sub.id);
    } else if (res.status === "error") {
      console.error(`[push] send to ${sub.id} failed:`, res.message);
    }
    // "skipped" (VAPID unset) leaves delivered=false; the caller no-ops.
  }
  if (deadIds.length > 0) {
    const { error } = await admin
      .from("push_subscriptions")
      .delete()
      .in("id", deadIds);
    if (error) {
      console.error("[push] prune dead subscriptions failed:", error.message);
    } else {
      pruned = deadIds.length;
    }
  }
  return { delivered, pruned };
}

// A single recipient to push: their user id, the rendered payload, and the
// idempotency-ledger write to perform iff the push is actually delivered.
export interface PushTarget {
  userId: string;
  payload: PushPayload;
}

// Generic dispatch tail shared by the match-needed and standing-changed pushes.
// For each target that is push-opted-in and has at least one subscription, send
// the payload, prune dead endpoints, and — only on a successful delivery —
// invoke `writeLedger` so re-runs stay at-most-once. Per-recipient failures are
// isolated (logged, counted) so one bad endpoint never aborts the batch.
export async function dispatchPushTargets(
  admin: AdminClient,
  targets: PushTarget[],
  writeLedger: (userId: string) => Promise<void>,
): Promise<PushDispatchSummary> {
  if (targets.length === 0) return { ...ZERO_PUSH };

  const userIds = targets.map((t) => t.userId);
  const prefs = await loadPushPrefs(admin, userIds);
  const optedIn = new Set(filterPushOptIns(userIds, prefs));
  const subsByUser = await loadSubscriptionsByUser(admin, [...optedIn]);

  let pushed = 0;
  let failed = 0;
  let pruned = 0;
  let skipped = 0;

  for (const target of targets) {
    if (!optedIn.has(target.userId)) {
      skipped++;
      continue;
    }
    const subs = subsByUser.get(target.userId);
    if (!subs || subs.length === 0) {
      skipped++;
      continue;
    }
    try {
      const { delivered, pruned: p } = await pushToUser(admin, subs, target.payload);
      pruned += p;
      if (delivered) {
        await writeLedger(target.userId);
        pushed++;
      } else {
        // Nothing delivered (all expired/skipped/errored). Not a hard failure
        // unless every endpoint errored; count it as failed only if we had
        // subscriptions but pruned none and delivered none.
        if (p === 0) failed++;
      }
    } catch (err) {
      failed++;
      console.error(`[push] dispatch to ${target.userId} failed:`, err);
    }
  }

  return { pushed, failed, pruned, skipped };
}
