// Daily-quiz helpers shared by the page and tests.

/** UTC YYYY-MM-DD key for a date. */
function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Current streak: the number of consecutive UTC days, ending today or
 * yesterday, on which the user answered. Today-not-yet-answered does not break
 * a streak (they still have the day), but a missed in-between day does.
 *
 * @param answeredAt ISO timestamps of the user's answers (any order, any tz).
 * @param now reference instant (injectable for tests).
 */
export function computeStreak(answeredAt: string[], now: Date = new Date()): number {
  const days = new Set(answeredAt.map((iso) => utcDayKey(new Date(iso))));
  if (days.size === 0) return 0;

  // Anchor at today (UTC midnight). If today has no answer, the streak can
  // still be alive from yesterday backwards; otherwise it's zero.
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (!days.has(utcDayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(utcDayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(utcDayKey(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
