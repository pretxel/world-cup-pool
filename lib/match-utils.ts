import type { MatchRow, MatchStatus } from "@/lib/db";

export function isLocked(match: Pick<MatchRow, "kickoff_at">): boolean {
  return new Date(match.kickoff_at).getTime() <= Date.now();
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
