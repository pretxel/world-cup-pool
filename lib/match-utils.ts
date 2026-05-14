import type { MatchRow, MatchStatus } from "@/lib/db";

export type LockReason = "final" | "cancelled" | "live" | "kickoff";

export function isLocked(match: {
  kickoff_at: string;
  status: string;
}): boolean {
  return lockReason(match) !== null;
}

export function lockReason(match: {
  kickoff_at: string;
  status: string;
}): LockReason | null {
  if (match.status === "final") return "final";
  if (match.status === "cancelled") return "cancelled";
  if (match.status === "live") return "live";
  if (new Date(match.kickoff_at).getTime() <= Date.now()) return "kickoff";
  return null;
}

export function statusLabel(status: string): string {
  switch (status as MatchStatus) {
    case "scheduled":
      return "Scheduled";
    case "live":
      return "Live";
    case "final":
      return "Final";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function stageLabel(stage: string): string {
  switch (stage as MatchRow["stage"]) {
    case "group":
      return "Group stage";
    case "r32":
      return "Round of 32";
    case "r16":
      return "Round of 16";
    case "qf":
      return "Quarter-final";
    case "sf":
      return "Semi-final";
    case "third":
      return "Third-place play-off";
    case "final":
      return "Final";
    default:
      return stage;
  }
}

export function utcDateKey(iso: string): string {
  return iso.slice(0, 10);
}
