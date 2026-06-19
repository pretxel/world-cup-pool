# Design — Streak Freeze / Weekly Pass

## Context

Two streaks drive daily return:

- **Quiz streak** — `computeStreak(answeredAt: string[], now: Date)` in
  `lib/quiz.ts`. Pure function: collapse `answered_at` timestamps to UTC day
  keys, anchor at today's UTC midnight (fall back to yesterday if today is
  unanswered), then count the consecutive run backwards. No weekly window, no
  cap. Consumed by `/quiz` (`app/[locale]/(public)/quiz/page.tsx`) and the quiz
  reminder email (`loadStreaks` in `lib/notifications/quiz-reminder-emails.ts`).

- **Prediction streak** — `computePredictionStreak(submittedAt: string[], now)`
  in `lib/prediction-streak.ts` (already shipped, spec `prediction-streak`).
  Same UTC-day logic but filtered to the current **Monday-anchored UTC week**
  (`currentUtcWeekBounds`), so it resets weekly and is capped at 7. Consumed by
  `/my-picks` (`app/[locale]/(app)/my-picks/page.tsx`).

The defining property of both: **the streak is never stored**. It is recomputed
on every read from raw timestamps with an injectable `now`, touches no database,
and imports no framework/Supabase module. This is what makes them unit-testable
and reproducible. A freeze must not break that contract.

That rules out the naive design — a `profiles.streak_freezes` integer
decremented once when a gap is seen. A single counter cannot say *which* gap was
forgiven, so the next read (with the gap still present in the timestamps) would
either re-break the streak or re-charge a freeze. The freeze must therefore be a
**ledger of (kind, consumed UTC day)** the pure function consults, so a forgiven
gap stays forgiven idempotently and the streak is a stable function of
(timestamps, freeze-days, now).

The relevant `análisis.md` framing: an *apuesta grande* ("Streak freeze / pase
semanal … reduce el efecto cliff") and §5.E ("segunda oportunidad para no romper
la racha"). The analysis floated a `profiles.weekly_streak_passes` field; this
design adopts the *intent* (a weekly pass) but rejects the single-field shape for
the determinism reason above.

## Goals / Non-Goals

**Goals:**

- Forgive a single one-day gap in either streak so it survives, without
  re-charging or re-breaking on subsequent reads (idempotent consumption).
- Keep `computeStreak` / `computePredictionStreak` pure and unit-testable: the
  freeze is passed in as data (consumed-freeze days), never fetched inside them.
- Bound the budget with a weekly allowance per kind, refilled on the same
  Monday-anchored UTC week boundary the prediction streak already uses.
- Independent budgets per streak kind (`quiz`, `prediction`) so spending a quiz
  freeze never affects predictions and vice versa.
- Surface remaining freezes and a "streak saved" moment on `/my-picks` and
  `/quiz`, localized en/es/fr/de, and keep the quiz reminder email truthful.
- Zero competitive-scoring impact: freezes touch display and reminder copy only.

**Non-Goals:**

- No purchasable, earned-by-points, or gifted freezes — a fixed weekly
  allowance only (a paid/earned economy can be a later change).
- No multi-day gap recovery — a freeze bridges exactly one day; a two-day gap
  still resets (the cliff is softened, not removed).
- No retroactive resurrection of streaks already broken before this ships —
  freezes apply from their grant week forward.
- No service worker, web push, VAPID, or new cron (those belong to the separate
  `push-notifications` bet).
- No new leaderboard, ranking, or scoring surface; no change to `scores`.
- No freeze on a streak of 0 (there is nothing to protect) and none for
  anonymous users (no `user_id`).

## Decisions

### 1. Ledger table, not a counter

Add `streak_freezes` (per-user, per-kind ledger). Two row classes distinguished
by what they record:

- **Grants** — a weekly allowance row per (`user_id`, `kind`, `week_start`)
  capturing how many freezes the user holds for that UTC week.
- **Consumptions** — a row per (`user_id`, `kind`, `consumed_day`) recording the
  exact UTC day a freeze bridged.

A unique constraint on (`user_id`, `kind`, `consumed_day`) makes consumption
**idempotent**: re-reading the same gap inserts nothing new. Remaining freezes
for a kind this week = granted-this-week minus consumptions whose `consumed_day`
falls in this week's window. (Implementable as two columns + a partial unique
index, or two row kinds + a `type` discriminator; the migration task picks the
concrete shape — the requirement is the idempotent, per-day, per-kind ledger.)

**DB migration (explicit):** one additive migration
`supabase/migrations/<ts>_streak_freezes.sql` creating the table with RLS —
owner-only `select` (`user_id = auth.uid()`), and **no** direct client insert;
consumption and weekly grant happen through a `security definer` RPC (or a
trusted server path) so a client cannot mint freezes. Purely additive; no
existing table altered. The `análisis.md` `profiles.weekly_streak_passes` idea
is deliberately not used (a single int can't be idempotent per gap).

### 2. Pure functions stay pure; freeze enters as data

Extend the two functions with an optional parameter — the set of UTC day-keys
the user has a *consumed* freeze for, e.g.

```
computeStreak(answeredAt, now, frozenDays?: Set<string>)
computePredictionStreak(submittedAt, now, frozenDays?: Set<string>)
```

When walking the consecutive run backwards, a cursor day that has no
answer/pick but **is** in `frozenDays` (and is a single isolated gap, not the
run's natural end) does not break the run — the cursor steps over it. Absent
`frozenDays`, behavior is byte-for-byte identical to today (default empty set),
so every existing scenario in the `daily-quiz` and `prediction-streak` specs
still holds. The functions still never touch the DB; the caller supplies
`frozenDays`.

### 3. Consumption decided outside the pure function, on read

A new server-side helper (`lib/streak-freeze.ts`) runs in the existing page /
email read paths:

1. Ensure the current week's grant exists for the user+kind (lazy weekly refill;
   insert-if-missing the grant row for this `week_start`).
2. Compute the *unfrozen* streak from timestamps.
3. Detect a **single one-day gap** immediately before the run that, if bridged,
   would extend it (today/yesterday-anchored, exactly one missing UTC day with
   activity on both sides within the relevant window).
4. If such a gap exists and the user has a remaining freeze for that kind, insert
   a consumption row for that gap day (idempotent via the unique constraint).
5. Re-read consumed-freeze days for the kind and pass them as `frozenDays` to the
   pure function for the value rendered.

Because consumption is recorded per UTC day with a unique constraint, step 4 is
safe under concurrent requests and repeated reads.

### 4. Weekly pass refill on the existing Monday-UTC boundary

The allowance refills per Monday-anchored UTC week — the exact boundary
`currentUtcWeekBounds` already defines in `lib/prediction-streak.ts`, reused (or
mirrored) so quiz and prediction freezes share one week definition. Default
allowance: a small fixed number per kind per week (e.g. 1), chosen so a streak
can survive at most one slip per week — enough to remove the cliff without
making the streak meaningless. The exact number is a single constant in
`lib/streak-freeze.ts`.

### 5. UI surfacing

- **`/my-picks`** — beside the existing streak `Stat` (FlameIcon, `statStreak` /
  `statStreakHint`), show remaining freezes for the week (e.g. a shield/snowflake
  glyph with a count) and, when the most recent gap was bridged this week, a
  short "streak saved" hint. Computed from data already loaded plus the freeze
  read; no extra round-trip beyond the single freeze query.
- **`/quiz`** — same treatment beside the quiz streak `Stat` (`streakLabel`).
- All new copy added to `messages/{en,es,fr,de}.json`, matching the existing
  per-locale convention.

### 6. Email truthfulness

`loadStreaks` in `lib/notifications/quiz-reminder-emails.ts` currently calls
`computeStreak` over each recipient's timestamps. It will pass the recipient's
consumed-freeze days so the reminder reflects the *protected* streak and never
implies a still-alive streak was lost. The email does not itself consume a
freeze (consumption is a read-path concern owned by the page helper); it reads
the already-recorded consumptions.

## Risks / Trade-offs

- **Determinism vs. lazy write on read.** Computing/consuming on read keeps us
  off cron but means a GET can write a consumption row. Mitigation: the write is
  insert-if-not-exists guarded by a unique constraint, so it is idempotent and
  concurrency-safe; a failed insert never throws into the page (best-effort, like
  the existing `loadStreaks` which "never throws"). Trade-off accepted to avoid
  new infra.
- **"Spend the gap day twice" / double-charge.** Prevented by the unique
  (`user_id`, `kind`, `consumed_day`) constraint — the same gap day can be
  charged at most once, ever.
- **Refill timing edge at the week boundary.** The grant is keyed by
  `week_start` (Monday UTC), so a refill cannot leak across weeks; a request in a
  new week lazily creates that week's grant. Quiz freezes (no weekly streak
  reset) and prediction freezes (weekly reset) share the same *grant* cadence but
  protect different streak definitions — documented so the asymmetry is intended,
  not a bug.
- **Pure-function regression risk.** The freeze parameter is optional and
  defaults to empty, so existing callers and tests are unchanged; the risk is a
  walk-backwards bug that skips too many days. Mitigation: tests asserting a
  freeze bridges exactly one gap and never two adjacent gaps, and that a frozen
  day at the *natural end* of the run does not invent activity.
- **Fairness / abuse.** A bounded weekly allowance and server-only minting
  (RLS + `security definer`) prevent freeze farming; no points or ranking are
  affected, so there is no competitive incentive to abuse it.
- **Migration ordering.** Additive table with RLS; no destructive change. Follows
  the repo's `YYYYMMDDHHMMSS_*.sql` convention and the owner-only RLS pattern
  used by other per-user tables.
- **Competitive scoring: none.** Explicitly verified — freezes never write
  `scores`, never feed any leaderboard/segmented RPC, and never alter rank
  snapshots. The only outputs are the streak number shown and the reminder copy.
