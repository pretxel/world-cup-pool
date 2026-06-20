import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Streak freeze / weekly pass.
//
// Both engagement streaks are PURE functions computed on read (`computeStreak`
// in lib/quiz.ts, `computePredictionStreak` in lib/prediction-streak.ts). A
// freeze forgives a single isolated one-day gap so the streak survives the
// "cliff". Because the streak is never stored, a freeze cannot be a one-shot
// counter mutation — it is a per-(user, kind, consumed UTC day) ledger
// (table `streak_freezes`) the pure functions consult via `frozenDays`.
//
// This module owns the read-path side: a lazy weekly grant, an idempotent
// gap-consumption decision, and the readers that surface remaining allowance +
// consumed days. The pure functions stay pure; this never runs inside them.

export type StreakKind = "quiz" | "prediction";

// Fixed weekly allowance per kind: one slip per week may be forgiven — enough
// to soften the cliff without making the streak meaningless. Refilled at each
// Monday-anchored UTC week boundary.
export const WEEKLY_FREEZE_ALLOWANCE = 1;

// A client that can read the owner's freeze rows and call the definer RPCs.
// Both the cookie-bound server client and the service-role admin client satisfy
// this; the admin client is used by the email path (reads only, never consumes).
type FreezeClient = SupabaseClient<Database>;

/** UTC YYYY-MM-DD key for a date. */
function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Half-open bounds `[start, end)` of the Monday-anchored UTC week containing
 * `now` — the exact boundary the prediction streak uses, so quiz and prediction
 * freezes share one week definition.
 */
export function currentFreezeWeekBounds(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // getUTCDay(): 0 = Sunday … 6 = Saturday. Days since Monday: Sun → 6, else d-1.
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

export interface FreezeState {
  /** Consumed-freeze UTC day-keys for the kind — fed to the pure streak fn. */
  frozenDays: Set<string>;
  /** Freezes still available this week (granted minus used). Never negative. */
  remaining: number;
  /** Whether a freeze was consumed this week (drives the "streak saved" copy). */
  usedThisWeek: boolean;
}

const EMPTY_STATE: FreezeState = {
  frozenDays: new Set(),
  remaining: 0,
  usedThisWeek: false,
};

// All consumed-freeze day-keys for a user+kind. Owner-only RLS scopes this to
// the caller on the cookie client; the admin client (email path) filters by
// user_id explicitly. Never throws — degrades to an empty set.
async function readConsumedDays(
  client: FreezeClient,
  userId: string,
  kind: StreakKind,
): Promise<Set<string>> {
  try {
    const { data, error } = await client
      .from("streak_freezes")
      .select("consumed_day")
      .eq("user_id", userId)
      .eq("kind", kind)
      .eq("row_kind", "consumption");
    if (error || !data) return new Set();
    const out = new Set<string>();
    for (const row of data) {
      if (row.consumed_day) out.add(row.consumed_day);
    }
    return out;
  } catch {
    return new Set();
  }
}

// The granted amount for the current week (0 if no grant row yet).
async function readGrantedThisWeek(
  client: FreezeClient,
  userId: string,
  kind: StreakKind,
  now: Date,
): Promise<number> {
  try {
    const { start } = currentFreezeWeekBounds(now);
    const { data, error } = await client
      .from("streak_freezes")
      .select("amount")
      .eq("user_id", userId)
      .eq("kind", kind)
      .eq("row_kind", "grant")
      .eq("week_start", utcDayKey(start))
      .maybeSingle();
    if (error || !data) return 0;
    return data.amount ?? 0;
  } catch {
    return 0;
  }
}

// Pure: detect the single one-day gap that, if bridged, extends the current
// run. Returns the UTC day-key of the missed day, or null when there is no
// eligible gap (no run to protect, the anchor is missing, the gap is not
// exactly one day, or there is no real activity on both sides). Mirrors the
// walk in the pure streak functions so consumption matches what they will count.
export function detectEligibleGapDay(
  activityDays: Set<string>,
  now: Date,
  weekStart?: Date,
): string | null {
  if (activityDays.size === 0) return null;

  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // Anchor on real activity (today, else yesterday). No anchor → nothing alive.
  if (!activityDays.has(utcDayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!activityDays.has(utcDayKey(cursor))) return null;
  }

  const inWindow = (d: Date) => weekStart === undefined || d >= weekStart;

  // Walk the consecutive run backwards. The first missed day whose prior day
  // has real activity (and both sides are in the relevant window) is the
  // bridgeable single gap.
  while (activityDays.has(utcDayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  // `cursor` is now the first missed day below the run.
  const gapKey = utcDayKey(cursor);
  const probe = new Date(cursor);
  probe.setUTCDate(probe.getUTCDate() - 1);
  if (
    activityDays.has(utcDayKey(probe)) &&
    inWindow(cursor) &&
    inWindow(probe)
  ) {
    return gapKey;
  }
  return null;
}

/**
 * Read-path freeze resolution for a signed-in user + kind. Best-effort and
 * idempotent:
 *
 *   1. Lazily ensure this week's grant exists (definer RPC; insert-if-missing).
 *   2. Detect a single eligible one-day gap in the raw activity.
 *   3. If one exists and a freeze remains, consume it (definer RPC; idempotent
 *      via the unique consumed-day index — same gap is never charged twice).
 *   4. Re-read consumed days + remaining allowance for display and for the pure
 *      streak function.
 *
 * Never throws into the render: any failure degrades to no protection. No freeze
 * is consumed for an anonymous user (no `userId`), at streak 0 (no eligible
 * gap), or when no allowance remains.
 *
 * @param activityDays UTC day-keys of the user's raw activity for this kind
 *   (for predictions, already filtered to the current week by the caller).
 * @param weekStart pass the week start to confine gap detection to the weekly
 *   window (prediction kind); omit for the unbounded quiz streak.
 */
export async function resolveStreakFreeze(
  client: FreezeClient,
  userId: string | null | undefined,
  kind: StreakKind,
  activityDays: Set<string>,
  now: Date = new Date(),
  weekStart?: Date,
): Promise<FreezeState> {
  if (!userId) return EMPTY_STATE;

  try {
    // 1. Lazy weekly grant (insert-if-missing). The RPC returns the granted
    //    amount; ignore failures (we re-read below either way).
    await client.rpc("grant_streak_freeze", {
      p_kind: kind,
      p_amount: WEEKLY_FREEZE_ALLOWANCE,
    });
  } catch {
    // best-effort
  }

  // 2 + 3. Consume an eligible gap if one remains. We optimistically attempt
  // consumption only when a gap exists; the RPC itself enforces the remaining
  // budget and idempotency, so a re-read of the same gap is a no-op.
  const gapDay = detectEligibleGapDay(activityDays, now, weekStart);
  if (gapDay) {
    try {
      await client.rpc("consume_streak_freeze", {
        p_kind: kind,
        p_consumed_day: gapDay,
      });
    } catch {
      // best-effort
    }
  }

  // 4. Re-read the authoritative state.
  const [frozenDays, granted] = await Promise.all([
    readConsumedDays(client, userId, kind),
    readGrantedThisWeek(client, userId, kind, now),
  ]);

  const { start, end } = currentFreezeWeekBounds(now);
  let usedThisWeek = 0;
  for (const day of frozenDays) {
    const d = new Date(`${day}T00:00:00Z`);
    if (d >= start && d < end) usedThisWeek++;
  }
  const remaining = Math.max(0, granted - usedThisWeek);

  return {
    frozenDays,
    remaining,
    usedThisWeek: usedThisWeek > 0,
  };
}

/**
 * Email-path read: the consumed-freeze days for a set of users + kind, WITHOUT
 * consuming or granting (the email never mints freezes — that is owned by the
 * page read paths). Returns a per-user set so the reminder reflects the
 * already-protected streak. Best-effort; degrades to empty.
 */
export async function loadConsumedFreezeDays(
  client: FreezeClient,
  userIds: string[],
  kind: StreakKind,
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (userIds.length === 0) return out;
  try {
    const { data, error } = await client
      .from("streak_freezes")
      .select("user_id, consumed_day")
      .in("user_id", userIds)
      .eq("kind", kind)
      .eq("row_kind", "consumption");
    if (error || !data) return out;
    for (const row of data) {
      if (!row.consumed_day) continue;
      const set = out.get(row.user_id) ?? new Set<string>();
      set.add(row.consumed_day);
      out.set(row.user_id, set);
    }
    return out;
  } catch {
    return out;
  }
}
