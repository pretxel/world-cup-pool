import type { MatchRow, MatchStatus } from "@/lib/db";
import { flagSlug } from "@/lib/team-flag";

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

// --- Team filter (ephemeral, URL-driven) ---------------------------------
// Teams are plain text on matches; there is no team entity. These helpers back
// the `?team=` filter on the public /matches list. A "team" key is the team's
// display name, case-folded, so comparisons are case-insensitive while the URL
// and chips keep canonical names.

type TeamPair = { home_team: string; away_team: string };

// Normalize a `?team=` value into a set of case-folded team keys. Accepts a
// single comma-separated string ("Brazil,Argentina") and/or a repeated param
// (["Brazil", "Mexico"]). Blank segments are dropped.
export function parseTeamParam(raw: string | string[] | undefined): Set<string> {
  if (!raw) return new Set();
  const parts = (Array.isArray(raw) ? raw : [raw])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  return new Set(parts);
}

// Distinct real country teams present in a match list, sorted alphabetically
// for a stable chip order. Knockout placeholders (values with no flag mapping,
// e.g. "2nd Group A") are excluded.
export function filterableTeams(matches: TeamPair[]): string[] {
  const teams = new Set<string>();
  for (const match of matches) {
    if (flagSlug(match.home_team)) teams.add(match.home_team);
    if (flagSlug(match.away_team)) teams.add(match.away_team);
  }
  return [...teams].sort((a, b) => a.localeCompare(b));
}

// Drop unknown/placeholder values from a parsed selection by intersecting it
// with the known filterable teams. Returns canonical team names in
// `available` order, so an all-unknown `?team=` collapses to an empty (= "All")
// selection.
export function reconcileSelectedTeams(
  selected: Set<string>,
  available: string[],
): string[] {
  return available.filter((team) => selected.has(team.toLowerCase()));
}

// True when a match involves any selected team (case-insensitive on either
// side). An empty selection matches every fixture.
export function matchInvolvesTeam(match: TeamPair, selected: Set<string>): boolean {
  if (selected.size === 0) return true;
  return (
    selected.has(match.home_team.toLowerCase()) ||
    selected.has(match.away_team.toLowerCase())
  );
}

// --- Status + needs-pick filters (ephemeral, URL-driven) ------------------
// Back the `?status=` and `?picks=` filters on the public /matches list, with
// the same drop-unknown defense as the team filter: a bad param value falls
// back to "no filter" instead of erroring.

export type MatchStatusFilter = "upcoming" | "live" | "final";

const STATUS_FILTERS: readonly MatchStatusFilter[] = ["upcoming", "live", "final"];

// Normalize a `?status=` value. Single-select: a repeated param keeps the
// first recognized value; anything unknown yields null (= no status filter).
export function parseStatusParam(
  raw: string | string[] | undefined,
): MatchStatusFilter | null {
  if (!raw) return null;
  for (const value of Array.isArray(raw) ? raw : [raw]) {
    const key = value.trim().toLowerCase();
    if ((STATUS_FILTERS as readonly string[]).includes(key)) {
      return key as MatchStatusFilter;
    }
  }
  return null;
}

// True only for the exact opt-in value `picks=needed` (first value wins for a
// repeated param). Everything else is ignored.
export function parsePicksParam(raw: string | string[] | undefined): boolean {
  if (!raw) return false;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim().toLowerCase() === "needed";
}

// Bucket a match for the header stats / status filter. Locked-but-not-live
// fixtures count as "upcoming" so the three buckets sum to the listed total;
// the per-row badge still distinguishes locked from open.
export function statusBucket(match: {
  kickoff_at: string;
  status: string;
}): MatchStatusFilter | "cancelled" {
  if (match.status === "live") return "live";
  if (match.status === "final") return "final";
  if (match.status === "cancelled") return "cancelled";
  return "upcoming";
}

// A match still needs the user's pick when they haven't predicted it and it is
// still open (scheduled and unlocked). Locked/live/final fixtures are no
// longer actionable, so they never count.
export function needsPick(
  match: { id: string; kickoff_at: string; status: string },
  pickedIds: ReadonlySet<string>,
): boolean {
  return !pickedIds.has(match.id) && !isLocked(match);
}

// A match is "confirmed" once both participants are real participating
// countries. Knockout fixtures seed placeholder participants ("2nd Group A",
// "Winner Match 73", …) that don't resolve to a flag; those stay unconfirmed
// until an admin sets the real teams. Drives public visibility and pickability.
export function isConfirmedMatch(match: TeamPair): boolean {
  return flagSlug(match.home_team) !== null && flagSlug(match.away_team) !== null;
}
