// Pure, DB-free ordering for the My Picks list. Lives here (mirrors
// lib/pagination.ts) so the sort is unit-testable away from the page and the
// kickoff-order contract cannot silently regress.
//
// Why this exists: the predictions query embeds the match to-one, and a
// PostgREST `.order(col, { referencedTable })` only orders rows *within* that
// embed — never the parent predictions. So ordering must happen in memory,
// over the full set, before pagination windows it.

// Minimal shape the sort reads. Generic over the caller's row type so the
// function returns exactly what it was given (richer rows keep their fields).
export interface SortablePick {
  match_id: string;
  matches: { kickoff_at: string | null } | null;
}

// Parse an ISO kickoff to an epoch for comparison. Missing / unparseable
// values become -Infinity so they sort last in the descending order instead
// of poisoning it.
function kickoffTime(pick: SortablePick): number {
  const iso = pick.matches?.kickoff_at;
  if (!iso) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

// Return a NEW array of the picks ordered by their match's kickoff time
// descending (latest first). Ties (same kickoff) break by `match_id`
// ascending so the order is total and reproducible run-to-run. Does not
// mutate the input.
export function sortPicksByKickoffDesc<T extends SortablePick>(
  picks: readonly T[],
): T[] {
  return [...picks].sort((a, b) => {
    const ta = kickoffTime(a);
    const tb = kickoffTime(b);
    if (ta !== tb) return tb - ta;
    if (a.match_id < b.match_id) return -1;
    if (a.match_id > b.match_id) return 1;
    return 0;
  });
}
