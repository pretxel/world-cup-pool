import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

// The background jobs the operations control room observes. Shared by the cron
// handlers (which record their runs) and the dashboard (which lists them).
export type OperationKind =
  | "sync_matches"
  | "sync_news"
  | "prediction_reminders"
  | "quiz_reminders"
  | "results_digest"
  | "recap_digest"
  | "comeback_emails"
  | "playoff_score_email"
  | "score_rules_email"
  | "winners_email";

export const OPERATION_KINDS: readonly OperationKind[] = [
  "sync_matches",
  "sync_news",
  "prediction_reminders",
  "quiz_reminders",
  "results_digest",
  "recap_digest",
  "comeback_emails",
  "playoff_score_email",
  "score_rules_email",
  "winners_email",
] as const;

// How a run was started: the daily schedule, or an admin pressing "Run now".
export type OperationTrigger = "cron" | "manual";

// success = no errors; partial = the job completed but its summary reported a
// non-zero error/failure count; error = the job threw before/while running.
export type OperationStatus = "success" | "partial" | "error";

// A job summary is an arbitrary bag of counts. We inspect the conventional
// failure keys to tell "completed cleanly" from "completed with some failures".
export type OperationSummary = Record<string, unknown>;

// Summary keys whose non-zero value means "finished, but something went wrong".
// `errors` covers sync-matches/sync-news; `failed` covers the reminder jobs.
const FAILURE_KEYS = ["errors", "failed"] as const;

// Pure: classify a completed (non-throwing) run from its summary counts.
// Exported for unit testing.
export function deriveStatus(summary: OperationSummary): "success" | "partial" {
  for (const key of FAILURE_KEYS) {
    const value = summary[key];
    if (typeof value === "number" && value > 0) return "partial";
  }
  return "success";
}

// The fully-resolved record handed to the writer once a run finishes.
export interface RunRecord {
  kind: OperationKind;
  trigger: OperationTrigger;
  status: OperationStatus;
  summary: OperationSummary;
  error: string | null;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
}

// Persists one run record, returning its id (or null on failure). Pulled out as
// a seam so tests can inject a fake without a database.
export type RunWriter = (record: RunRecord) => Promise<string | null>;

export interface RecordedRun<T> {
  summary: T;
  status: OperationStatus;
  runId: string | null;
}

// Default writer: insert via the service-role admin client. Best-effort and
// self-contained — never throws, so a ledger failure can't reach the job path.
const defaultWriter: RunWriter = async (record) => {
  try {
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from("operation_runs")
      .insert({
        kind: record.kind,
        trigger: record.trigger,
        status: record.status,
        summary: record.summary as Json,
        error: record.error,
        started_at: record.startedAt.toISOString(),
        finished_at: record.finishedAt.toISOString(),
        duration_ms: record.durationMs,
      })
      .select("id")
      .single();
    if (error) {
      console.error(`[operation-runs] failed to record ${record.kind} run:`, error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error(`[operation-runs] failed to record ${record.kind} run:`, err);
    return null;
  }
};

// Calls the writer but absorbs any throw, so a fake writer that rejects (or a
// future writer that forgets to guard) can never mask the job's own result.
async function safeWrite(writer: RunWriter, record: RunRecord): Promise<string | null> {
  try {
    return await writer(record);
  } catch (err) {
    console.error(`[operation-runs] writer threw while recording ${record.kind} run:`, err);
    return null;
  }
}

// Times `fn`, derives its status, and records exactly one operation_runs row —
// on success AND on failure. The job's own behavior is untouched: a thrown job
// error is recorded (status='error') and then RE-THROWN so the caller (e.g. a
// cron route) still surfaces the failure; recording the row is best-effort and
// never masks the job's success or failure.
// `T` is intentionally unconstrained: a job summary is often a named interface
// (e.g. DispatchSummary) which lacks the implicit index signature that
// `Record<string, unknown>` requires, so constraining to OperationSummary would
// reject real callers. We narrow to OperationSummary internally for inspection.
export async function recordRun<T>(
  kind: OperationKind,
  trigger: OperationTrigger,
  fn: () => Promise<T>,
  writer: RunWriter = defaultWriter,
): Promise<RecordedRun<T>> {
  const startedAt = new Date();
  let summary: T;
  try {
    summary = await fn();
  } catch (err) {
    const finishedAt = new Date();
    await safeWrite(writer, {
      kind,
      trigger,
      status: "error",
      summary: {},
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    });
    throw err;
  }

  const finishedAt = new Date();
  const summaryRecord = summary as unknown as OperationSummary;
  const status = deriveStatus(summaryRecord);
  const runId = await safeWrite(writer, {
    kind,
    trigger,
    status,
    summary: summaryRecord,
    error: null,
    startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  });

  return { summary, status, runId };
}
