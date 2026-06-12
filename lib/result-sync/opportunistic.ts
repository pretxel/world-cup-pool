import { after } from "next/server";
import { runSync } from "@/lib/result-sync/core";
import {
  findStaleMatches,
  type StalenessShape,
} from "@/lib/result-sync/staleness";

// Per-instance debounce. Fluid Compute reuses instances across requests, so
// this meaningfully caps the trigger rate; the worst case (many cold
// instances) is a handful of extra idempotent runs, which the sources and the
// write path tolerate.
const MIN_INTERVAL_MS = 5 * 60 * 1000;
let lastAttemptAt = 0;

// Decide-and-claim: returns true at most once per MIN_INTERVAL_MS when the
// already-loaded match list contains a stale match. Claiming the slot before
// the run starts (rather than after it finishes) keeps concurrent renders
// from piling up runs.
export function shouldAttemptOpportunisticSync(
  matches: StalenessShape[],
  now: Date = new Date(),
): boolean {
  if (findStaleMatches(matches, now).length === 0) return false;
  if (now.getTime() - lastAttemptAt < MIN_INTERVAL_MS) return false;
  lastAttemptAt = now.getTime();
  return true;
}

// Cron-not-firing safety net: piggyback on page traffic. Call from a dynamic
// server component render with the match list it already loaded; the sync runs
// after the response is sent (next/server `after`) so the page pays only for
// the in-memory staleness scan.
export function maybeScheduleOpportunisticSync(
  matches: StalenessShape[],
  now: Date = new Date(),
): boolean {
  if (!shouldAttemptOpportunisticSync(matches, now)) return false;
  after(async () => {
    try {
      const summary = await runSync();
      console.log(
        "[result-sync:opportunistic] summary:",
        JSON.stringify(summary),
      );
    } catch (err) {
      console.error("[result-sync:opportunistic] run failed:", err);
    }
  });
  return true;
}
