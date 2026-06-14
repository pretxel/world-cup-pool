import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { OperationRunRow } from "@/lib/db";
import { OPERATION_KINDS, type OperationKind, type OperationStatus } from "./record-run";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// How far back the "recent window" reaches for email/activity counts.
const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function windowStart(now: Date): string {
  return new Date(now.getTime() - WINDOW_DAYS * DAY_MS).toISOString();
}

// ---------------------------------------------------------------------------
// Operation runs — overview + history
// ---------------------------------------------------------------------------

// The most recent run per job kind (or null when a job has never run). Four
// tiny indexed lookups (one per kind) rather than scanning the whole ledger.
export async function getLatestRunPerKind(): Promise<
  Record<OperationKind, OperationRunRow | null>
> {
  const admin = createAdminSupabaseClient();
  const entries = await Promise.all(
    OPERATION_KINDS.map(async (kind) => {
      const { data } = await admin
        .from("operation_runs")
        .select("*")
        .eq("kind", kind)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return [kind, (data as OperationRunRow | null) ?? null] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<OperationKind, OperationRunRow | null>;
}

export interface RunHistoryFilter {
  kind?: OperationKind;
  status?: OperationStatus;
  page: number;
  pageSize: number;
}

export interface RunHistoryPage {
  rows: OperationRunRow[];
  total: number;
}

// Paginated, most-recent-first run history with optional kind/status filters.
export async function getRunHistory(filter: RunHistoryFilter): Promise<RunHistoryPage> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("operation_runs")
    .select("*", { count: "exact" })
    .order("started_at", { ascending: false });
  if (filter.kind) query = query.eq("kind", filter.kind);
  if (filter.status) query = query.eq("status", filter.status);

  const from = (filter.page - 1) * filter.pageSize;
  const to = from + filter.pageSize - 1;
  const { data, count } = await query.range(from, to);
  return { rows: (data ?? []) as OperationRunRow[], total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// Recipient resolution — display name (profiles) + email (auth.users)
// ---------------------------------------------------------------------------

// Player emails live only in auth.users — reachable via the service-role admin
// client (same path as result-emails). Resolves a set of ids once, tolerating
// per-id failures (a missing address just yields null).
async function resolveEmails(
  admin: AdminClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  await Promise.all(
    [...new Set(userIds)].map(async (id) => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(id);
        out.set(id, error ? null : (data.user?.email ?? null));
      } catch {
        out.set(id, null);
      }
    }),
  );
  return out;
}

async function resolveDisplayNames(
  admin: AdminClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const { data } = await admin.from("profiles").select("id, display_name").in("id", ids);
  return new Map((data ?? []).map((r) => [r.id, r.display_name]));
}

// ---------------------------------------------------------------------------
// Email logs — derived from the three send ledgers
// ---------------------------------------------------------------------------

export type EmailEventType = "result" | "prediction_reminder" | "quiz_reminder";

export interface EmailEvent {
  type: EmailEventType;
  userId: string;
  displayName: string | null;
  email: string | null;
  sentAt: string;
}

export interface EmailLogs {
  events: EmailEvent[];
  totals: Record<EmailEventType, number>;
}

// Unions the three at-most-once send ledgers into one recipient-resolved feed,
// plus per-type counts over the recent window. No new email table — these are
// the same rows the cron jobs already stamp on every successful send.
export async function getEmailLogs(now: Date, limit = 40): Promise<EmailLogs> {
  const admin = createAdminSupabaseClient();
  const since = windowStart(now);
  const per = Math.max(limit, 25);

  const [result, prediction, quiz, resultCount, predictionCount, quizCount] = await Promise.all([
    admin
      .from("result_email_log")
      .select("user_id, sent_at")
      .order("sent_at", { ascending: false })
      .limit(per),
    admin
      .from("prediction_reminder_log")
      .select("user_id, sent_at")
      .order("sent_at", { ascending: false })
      .limit(per),
    admin
      .from("quiz_reminder_log")
      .select("user_id, sent_at")
      .order("sent_at", { ascending: false })
      .limit(per),
    admin
      .from("result_email_log")
      .select("user_id", { count: "exact", head: true })
      .gte("sent_at", since),
    admin
      .from("prediction_reminder_log")
      .select("user_id", { count: "exact", head: true })
      .gte("sent_at", since),
    admin
      .from("quiz_reminder_log")
      .select("user_id", { count: "exact", head: true })
      .gte("sent_at", since),
  ]);

  const merged: Omit<EmailEvent, "displayName" | "email">[] = [
    ...(result.data ?? []).map((r) => ({
      type: "result" as const,
      userId: r.user_id,
      sentAt: r.sent_at,
    })),
    ...(prediction.data ?? []).map((r) => ({
      type: "prediction_reminder" as const,
      userId: r.user_id,
      sentAt: r.sent_at,
    })),
    ...(quiz.data ?? []).map((r) => ({
      type: "quiz_reminder" as const,
      userId: r.user_id,
      sentAt: r.sent_at,
    })),
  ]
    .sort((a, b) => (a.sentAt < b.sentAt ? 1 : a.sentAt > b.sentAt ? -1 : 0))
    .slice(0, limit);

  const userIds = merged.map((m) => m.userId);
  const [names, emails] = await Promise.all([
    resolveDisplayNames(admin, userIds),
    resolveEmails(admin, userIds),
  ]);

  const events: EmailEvent[] = merged.map((m) => ({
    ...m,
    displayName: names.get(m.userId) ?? null,
    email: emails.get(m.userId) ?? null,
  }));

  return {
    events,
    totals: {
      result: resultCount.count ?? 0,
      prediction_reminder: predictionCount.count ?? 0,
      quiz_reminder: quizCount.count ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// User activity — derived from existing player tables
// ---------------------------------------------------------------------------

export type ActivityType = "signup" | "prediction" | "quiz_answer" | "group_join";

export interface ActivityEvent {
  type: ActivityType;
  userId: string;
  displayName: string | null;
  at: string;
}

export interface UserActivity {
  feed: ActivityEvent[];
  stats: {
    totalPlayers: number;
    activeLast7d: number;
    predictionOptOut: number;
    quizOptOut: number;
  };
}

// A time-ordered feed of recent player activity plus engagement aggregates, all
// read (never written) from existing tables. Admins are excluded from player
// counts, matching how they are excluded from leaderboards.
export async function getUserActivity(now: Date, limit = 30): Promise<UserActivity> {
  const admin = createAdminSupabaseClient();
  const since = windowStart(now);
  const per = 15;

  const [
    signups,
    predictions,
    quizAnswers,
    groupJoins,
    totalPlayers,
    activePred,
    activeQuiz,
    predictionOptOut,
    quizOptOut,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name, created_at")
      .eq("is_admin", false)
      .order("created_at", { ascending: false })
      .limit(per),
    admin
      .from("predictions")
      .select("user_id, submitted_at")
      .order("submitted_at", { ascending: false })
      .limit(per),
    admin
      .from("quiz_answers")
      .select("user_id, answered_at")
      .order("answered_at", { ascending: false })
      .limit(per),
    admin
      .from("group_members")
      .select("user_id, joined_at")
      .order("joined_at", { ascending: false })
      .limit(per),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_admin", false),
    admin.from("predictions").select("user_id").gte("submitted_at", since),
    admin.from("quiz_answers").select("user_id").gte("answered_at", since),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", false)
      .eq("prediction_reminder_opt_out", true),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", false)
      .eq("quiz_reminder_opt_out", true),
  ]);

  const raw: ActivityEvent[] = [
    ...(signups.data ?? []).map((r) => ({
      type: "signup" as const,
      userId: r.id,
      displayName: r.display_name,
      at: r.created_at,
    })),
    ...(predictions.data ?? []).map((r) => ({
      type: "prediction" as const,
      userId: r.user_id,
      displayName: null,
      at: r.submitted_at,
    })),
    ...(quizAnswers.data ?? []).map((r) => ({
      type: "quiz_answer" as const,
      userId: r.user_id,
      displayName: null,
      at: r.answered_at,
    })),
    ...(groupJoins.data ?? []).map((r) => ({
      type: "group_join" as const,
      userId: r.user_id,
      displayName: null,
      at: r.joined_at,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const feed = raw.slice(0, limit);

  // Fill display names for the non-signup rows in one lookup.
  const missing = feed.filter((e) => e.displayName == null).map((e) => e.userId);
  const names = await resolveDisplayNames(admin, missing);
  for (const e of feed) {
    if (e.displayName == null) e.displayName = names.get(e.userId) ?? null;
  }

  const activeUsers = new Set<string>([
    ...(activePred.data ?? []).map((r) => r.user_id),
    ...(activeQuiz.data ?? []).map((r) => r.user_id),
  ]);

  return {
    feed,
    stats: {
      totalPlayers: totalPlayers.count ?? 0,
      activeLast7d: activeUsers.size,
      predictionOptOut: predictionOptOut.count ?? 0,
      quizOptOut: quizOptOut.count ?? 0,
    },
  };
}
