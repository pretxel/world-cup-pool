// Recap reaction helpers shared by the server reads, the toggle action, and the
// client bar. Reactions are emoji taps (a fixed allowlist) on the ACTIVE recap
// version of a FINAL match; they carry zero competitive weight.

// Fixed allowlist. Keep in sync with:
//   * the `check (reaction in (...))` constraint on public.recap_reactions, and
//   * the server-side re-check in public.toggle_recap_reaction,
// both in supabase/migrations/20260620020000_recap_reactions.sql.
export const REACTION_TYPES = [
  "fire",
  "goal",
  "shock",
  "laugh",
  "clap",
  "sad",
] as const;

export type ReactionType = (typeof REACTION_TYPES)[number];

export function isReactionType(value: unknown): value is ReactionType {
  return (
    typeof value === "string" &&
    (REACTION_TYPES as readonly string[]).includes(value)
  );
}

// Display emoji for each reaction type (used by the bar and gallery badge). The
// human-readable label/aria text lives in the i18n catalogs, keyed by type.
export const REACTION_EMOJI: Record<ReactionType, string> = {
  fire: "🔥",
  goal: "⚽",
  shock: "😱",
  laugh: "😂",
  clap: "👏",
  sad: "😢",
};

// Per-type counts for one recap version, in the fixed allowlist order, plus the
// signed-in viewer's own selected types.
export type ReactionSummary = {
  counts: Record<ReactionType, number>;
  mine: ReactionType[];
  total: number;
};

export function emptyCounts(): Record<ReactionType, number> {
  return {
    fire: 0,
    goal: 0,
    shock: 0,
    laugh: 0,
    clap: 0,
    sad: 0,
  };
}

// Fold raw `(reaction, count)` rows (e.g. from v_recap_reaction_counts or the
// toggle RPC) into a complete, allowlist-ordered counts record. Unknown
// reaction values are ignored, so a future allowlist change can never crash a
// stale client.
export function foldCounts(
  rows: Array<{ reaction: string | null; count: number | null }>,
): Record<ReactionType, number> {
  const counts = emptyCounts();
  for (const row of rows) {
    if (isReactionType(row.reaction)) {
      counts[row.reaction] = row.count ?? 0;
    }
  }
  return counts;
}

export function sumCounts(counts: Record<ReactionType, number>): number {
  return REACTION_TYPES.reduce((acc, type) => acc + (counts[type] ?? 0), 0);
}

// Build the full summary the bar is seeded with: complete counts, the viewer's
// own selected types (filtered to the allowlist), and the grand total.
export function buildReactionSummary(
  countRows: Array<{ reaction: string | null; count: number | null }>,
  myReactions: Array<{ reaction: string | null }>,
): ReactionSummary {
  const counts = foldCounts(countRows);
  const mine = myReactions
    .map((r) => r.reaction)
    .filter(isReactionType)
    .filter((type, i, arr) => arr.indexOf(type) === i);
  return { counts, mine, total: sumCounts(counts) };
}
