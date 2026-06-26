import type { OperationKind } from "./record-run";

// The cron cadence for each background job, mirroring vercel.json. All four run
// once daily at a fixed UTC hour (`0 H * * *`), so the next run is simply today
// or tomorrow at that hour — no general cron parser needed. Kept beside the
// jobs so the operations overview can show "next run" without re-reading config.
//
// Type-only import of OperationKind keeps this module free of the server-only
// runtime in record-run.ts, so it is safe to use anywhere.
// `dowUtc` (0=Sun … 6=Sat) marks a weekly job that only fires on that UTC
// weekday; omit it for the daily jobs.
export const OPERATION_SCHEDULES: Record<
  OperationKind,
  { cron: string; hourUtc: number; dowUtc?: number }
> = {
  sync_news: { cron: "0 7 * * *", hourUtc: 7 },
  sync_matches: { cron: "0 9 * * *", hourUtc: 9 },
  prediction_reminders: { cron: "0 12 * * *", hourUtc: 12 },
  quiz_reminders: { cron: "0 13 * * *", hourUtc: 13 },
  results_digest: { cron: "0 11 * * *", hourUtc: 11 },
  // Runs a few times daily so completed comic renders are picked up shortly
  // after they finish (renders land asynchronously after a match goes final).
  // hourUtc is the soonest of those ticks, used only for the "next run" display.
  recap_digest: { cron: "0 6,14,22 * * *", hourUtc: 6 },
  comeback_emails: { cron: "0 15 * * *", hourUtc: 15 },
  // Weekly: only fires Saturday (dowUtc 6) at 11:00 UTC, after sync-matches.
  playoff_score_email: { cron: "0 11 * * 6", hourUtc: 11, dowUtc: 6 },
};

// The next UTC instant this job is scheduled to fire: today at its hour if that
// is still ahead, otherwise the next eligible day at its hour. For a weekly job
// (`dowUtc` set) the next instant is advanced to that UTC weekday.
export function nextScheduledRun(kind: OperationKind, now: Date): Date {
  const { hourUtc, dowUtc } = OPERATION_SCHEDULES[kind];
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0, 0),
  );
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  if (dowUtc != null) {
    // Advance day-by-day to the scheduled weekday (≤ 7 steps).
    while (next.getUTCDay() !== dowUtc) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  }
  return next;
}
