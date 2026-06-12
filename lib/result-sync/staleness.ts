import { isConfirmedMatch } from "@/lib/match-utils";

// A result is "overdue" once the match could not plausibly still be running:
// 90' + stoppage + extra time + penalties comfortably fit in 3 hours.
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export type StalenessShape = {
  kickoff_at: string;
  status: string;
  home_team: string;
  away_team: string;
};

// A match is stale when its result should exist but doesn't: kickoff is more
// than 3h past, it never reached a terminal status (final/cancelled — a
// cancelled match intentionally has no result), and both teams are real
// countries (knockout placeholders can't have results yet).
export function isStaleMatch(match: StalenessShape, now: Date): boolean {
  if (match.status === "final" || match.status === "cancelled") return false;
  if (!isConfirmedMatch(match)) return false;
  const kickoff = Date.parse(match.kickoff_at);
  if (Number.isNaN(kickoff)) return false;
  return now.getTime() - kickoff > STALE_AFTER_MS;
}

export function findStaleMatches<T extends StalenessShape>(
  matches: T[],
  now: Date,
): T[] {
  return matches.filter((m) => isStaleMatch(m, now));
}
