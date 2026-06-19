// --- Leaderboard segments (ephemeral, URL-driven) -------------------------
// Back the `?segment=` / `?stage=` switch on the public /leaderboard, with the
// same drop-unknown defense as the /matches filters: any bad/missing value
// falls back to the default ("overall") instead of erroring or redirecting.

export type LeaderboardSegment = "overall" | "week" | "stage";

const SEGMENTS: readonly LeaderboardSegment[] = ["overall", "week", "stage"];

// Normalize a `?segment=` value into a known segment. A repeated param keeps the
// first recognized value; anything unknown/missing yields "overall".
export function parseSegmentParam(
  raw: string | string[] | undefined,
): LeaderboardSegment {
  if (!raw) return "overall";
  for (const value of Array.isArray(raw) ? raw : [raw]) {
    const key = value.trim().toLowerCase();
    if ((SEGMENTS as readonly string[]).includes(key)) {
      return key as LeaderboardSegment;
    }
  }
  return "overall";
}

// Resolve a `?stage=` value against the competition's known stage keys. A
// repeated param keeps the first match; an unknown/missing value yields null so
// the caller can fall back to "overall" (the spec: stage segment with no valid
// stage is treated as overall). Comparison is exact on the canonical keys.
export function reconcileStageParam(
  raw: string | string[] | undefined,
  stageKeys: readonly string[],
): string | null {
  if (!raw) return null;
  const known = new Set(stageKeys);
  for (const value of Array.isArray(raw) ? raw : [raw]) {
    const key = value.trim();
    if (known.has(key)) return key;
  }
  return null;
}

// Resolve the effective segment given the parsed `segment` and the reconciled
// `stage`. A `stage` segment with no valid stage collapses to "overall"; every
// other case keeps the requested segment. Centralizes the fallback rule so the
// page and the switcher agree on what is "active".
export function resolveSegment(
  segment: LeaderboardSegment,
  stage: string | null,
): LeaderboardSegment {
  if (segment === "stage" && !stage) return "overall";
  return segment;
}

// The current week's half-open bounds [from, to) as ISO instants, with the week
// starting Monday 00:00 UTC — the canonical timezone the leaderboard already
// renders in (leaderboard_for_day defaults to UTC; day labels format in UTC).
// `now` is injectable so the same computation is unit-testable and clock-free,
// matching the windowing approach of leaderboard_for_day (which takes its date
// as an argument rather than reading the clock).
export function currentWeekBoundsUtc(now: Date = new Date()): {
  fromTs: string;
  toTs: string;
} {
  // Midnight UTC of the instant's calendar day.
  const dayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  // getUTCDay(): 0 = Sunday … 6 = Saturday. Days since the most recent Monday.
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const from = dayStart - daysSinceMonday * 86_400_000;
  const to = from + 7 * 86_400_000;
  return {
    fromTs: new Date(from).toISOString(),
    toTs: new Date(to).toISOString(),
  };
}
