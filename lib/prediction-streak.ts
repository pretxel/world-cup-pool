// Prediction-streak helper shared by the My Picks page and tests.
//
// Mirrors `computeStreak` in `lib/quiz.ts` (UTC day keys, anchor at today or
// yesterday, consecutive run backwards, same-day dedupe, timezone offsets
// normalized to the UTC calendar day) but adds a weekly reset: only
// `submitted_at` values inside the current Monday-anchored UTC week count, so
// the streak resets every week and can never exceed 7.

/** UTC YYYY-MM-DD key for a date. */
function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Half-open bounds `[startOfWeek, nextWeek)` of the UTC week containing `now`,
 * where the week starts at Monday 00:00:00 UTC. The anchor is fixed for
 * everyone regardless of locale/timezone, matching the quiz streak's UTC-day
 * convention.
 */
function currentUtcWeekBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // getUTCDay(): 0 = Sunday … 6 = Saturday. Days since Monday: Sun → 6, else d-1.
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

/**
 * Current prediction streak: the number of consecutive UTC days, ending today
 * or yesterday, on which the user submitted at least one prediction — counting
 * only predictions within the current Monday-anchored UTC week. Today-not-yet-
 * predicted does not break a streak (the day is still open), but a missed
 * in-between day does. Multiple picks on one UTC day count once, and timestamps
 * in any timezone offset are normalized to their UTC calendar day.
 *
 * Because last week's picks fall outside the window, a fresh Monday with no
 * pick yet yields 0 (today unanswered, yesterday is last week → outside the
 * window → breaks) — the intended weekly reset. The streak can never exceed 7.
 *
 * A `frozenDays` set of consumed-freeze UTC day-keys forgives single isolated
 * one-day gaps inside the weekly window (the missed day counts and the walk
 * steps over it, but only when the day beyond it has a real in-week pick — so a
 * freeze never invents activity, a two-day gap with one frozen day still breaks,
 * and the 7-day weekly cap is preserved because only in-week days are walked).
 * With no `frozenDays` (the default), behavior is identical to the original.
 *
 * @param submittedAt ISO timestamps of the user's predictions (any order, any tz).
 * @param now reference instant (injectable for tests).
 * @param frozenDays UTC day-keys the user holds a consumed freeze for.
 */
export function computePredictionStreak(
  submittedAt: string[],
  now: Date = new Date(),
  frozenDays: Set<string> = new Set(),
): number {
  const { start, end } = currentUtcWeekBounds(now);

  // Keep only this week's submissions, then collapse to UTC day keys.
  const days = new Set(
    submittedAt
      .map((iso) => new Date(iso))
      .filter((d) => d >= start && d < end)
      .map(utcDayKey),
  );
  if (days.size === 0) return 0;

  // Anchor at today (UTC midnight). If today has no pick, the streak can still
  // be alive from yesterday backwards; otherwise it's zero. The anchor uses
  // real in-week activity only — a freeze is never spent on it.
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (!days.has(utcDayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(utcDayKey(cursor))) return 0;
  }

  let streak = 0;
  for (;;) {
    const key = utcDayKey(cursor);
    if (days.has(key)) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      continue;
    }
    // A consumed freeze bridges this missed day only when it is a single
    // isolated gap with a real in-week pick the day before. The probe day is
    // necessarily inside the week (only in-week days populate `days`), so the
    // weekly window and the 7-day cap are preserved.
    if (frozenDays.has(key)) {
      const probe = new Date(cursor);
      probe.setUTCDate(probe.getUTCDate() - 1);
      if (days.has(utcDayKey(probe))) {
        streak++;
        cursor.setTime(probe.getTime());
        continue;
      }
    }
    break;
  }
  return streak;
}
