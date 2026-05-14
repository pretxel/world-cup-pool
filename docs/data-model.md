# Data model

Every column, constraint, index, RLS policy, view, and function in the World
Cup 2026 Pool schema. The runtime source of truth is
[`supabase/migrations/20260513000000_init.sql`](../supabase/migrations/20260513000000_init.sql);
all line references in this doc point into that file.

The TypeScript view of the schema is regenerated into
[`lib/database.types.ts`](../lib/database.types.ts) with friendlier narrowed
aliases (`MatchRow`, `MatchStatus`, `HitType`, `LeaderboardRow`) in
[`lib/db.ts`](../lib/db.ts).

## Tables

### `public.profiles`

One row per authenticated user, created automatically on first sign-in by the
`trg_on_auth_user_created` trigger. Source:
[`supabase/migrations/20260513000000_init.sql:11`](../supabase/migrations/20260513000000_init.sql).

| Column         | Type                                 | Notes                                                                     |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `id`           | `uuid` PK                            | FK → `auth.users(id) on delete cascade`.                                  |
| `display_name` | `text`                               | Nullable until set in onboarding. `check (char_length between 2 and 32)`. |
| `is_admin`     | `boolean not null default false`     | Gates the admin UI. See guard below.                                      |
| `created_at`   | `timestamptz not null default now()` |                                                                           |
| `updated_at`   | `timestamptz not null default now()` | Auto-bumped by `trg_profiles_updated_at`.                                 |

**Auto-creation on signup:** `trg_on_auth_user_created` (migration line 99)
fires `handle_new_user()` `AFTER INSERT ON auth.users`, which inserts an empty
`profiles` row.

**Self-promotion guard:** `trg_profiles_guard_is_admin` (line 315) blocks any
`UPDATE` that changes `is_admin` unless the JWT role is `service_role` or
absent. So only the service-role client (used from the Supabase SQL editor or
admin actions) can promote a user.

#### RLS policies

| Operation | Policy                                     | Allows                                                                            |
| --------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| SELECT    | `profiles_select_authenticated` (line 278) | Any signed-in user reads any profile (needed for the leaderboard `display_name`). |
| UPDATE    | `profiles_update_own` (line 283)           | A user updating their own row (`id = auth.uid()`).                                |
| ALL       | `profiles_admin_all` (line 289)            | Admins (`public.is_admin()` true) can read/write any row.                         |

The `is_admin` column is further protected by the trigger above so
`profiles_update_own` cannot be used to self-promote.

---

### `public.matches`

Source: [`supabase/migrations/20260513000000_init.sql:21`](../supabase/migrations/20260513000000_init.sql).

| Column       | Type                                  | Notes                                                              |
| ------------ | ------------------------------------- | ------------------------------------------------------------------ |
| `id`         | `uuid` PK `default gen_random_uuid()` |                                                                    |
| `stage`      | `text not null`                       | `check (stage in ('group','r32','r16','qf','sf','third','final'))` |
| `group_code` | `text`                                | Nullable for knockout fixtures. `check (group_code ~ '^[A-L]$')`   |
| `home_team`  | `text not null`                       | `check (char_length > 0)`                                          |
| `away_team`  | `text not null`                       | `check (char_length > 0 and away_team <> home_team)`               |
| `kickoff_at` | `timestamptz not null`                | UTC.                                                               |
| `venue`      | `text`                                |                                                                    |
| `home_score` | `smallint`                            | Nullable until final. `check (between 0 and 30)`                   |
| `away_score` | `smallint`                            | Nullable until final. `check (between 0 and 30)`                   |
| `status`     | `text not null default 'scheduled'`   | `check (status in ('scheduled','live','final','cancelled'))`       |
| `created_at` | `timestamptz not null default now()`  |                                                                    |
| `updated_at` | `timestamptz not null default now()`  | Auto-bumped by `trg_matches_updated_at`.                           |

#### Indexes

- `matches_kickoff_at_idx` on `(kickoff_at)` — used by the matches list and
  the daily leaderboard date window.
- `matches_status_idx` on `(status)` — speeds up "all final matches" reads.

#### Triggers

- `trg_matches_updated_at` `BEFORE UPDATE` → `set_updated_at()` (line 79).
- `trg_recompute_scores_on_match_change` `AFTER INSERT OR UPDATE` →
  `trg_recompute_scores()` (line 172). Only fires the scoring recompute when
  `home_score`, `away_score`, or `status` actually changed.

#### RLS policies

| Operation | Policy                             | Allows                                                |
| --------- | ---------------------------------- | ----------------------------------------------------- |
| SELECT    | `matches_select_public` (line 320) | `anon` and `authenticated` — match catalog is public. |
| ALL       | `matches_admin_write` (line 325)   | Only admins can insert/update/delete.                 |

---

### `public.predictions`

Source: [`supabase/migrations/20260513000000_init.sql:39`](../supabase/migrations/20260513000000_init.sql).

| Column         | Type                                  | Notes                                 |
| -------------- | ------------------------------------- | ------------------------------------- |
| `id`           | `uuid` PK `default gen_random_uuid()` |                                       |
| `user_id`      | `uuid not null`                       | FK → `profiles(id) on delete cascade` |
| `match_id`     | `uuid not null`                       | FK → `matches(id) on delete cascade`  |
| `home_goals`   | `smallint not null`                   | `check (between 0 and 20)`            |
| `away_goals`   | `smallint not null`                   | `check (between 0 and 20)`            |
| `submitted_at` | `timestamptz not null default now()`  | Refreshed on every upsert.            |
|                |                                       | `unique (user_id, match_id)`          |

#### Indexes

- `predictions_match_id_idx` on `(match_id)` — used by the scoring recompute.
- `predictions_user_id_idx` on `(user_id)` — used by `/my-picks`.
- The `unique (user_id, match_id)` constraint also acts as a btree index.

#### RLS policies — the kickoff lock lives here

| Operation | Policy                                             | Condition                                                                          |
| --------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| SELECT    | `predictions_select_own` (line 332)                | `user_id = auth.uid()`                                                             |
| SELECT    | `predictions_select_after_final` (line 337)        | Match `status = 'final'` (then anyone signed-in can read all picks for that match) |
| SELECT    | `predictions_admin_select_all` (line 376)          | `public.is_admin()`                                                                |
| INSERT    | `predictions_insert_own_before_kickoff` (line 347) | `user_id = auth.uid()` AND match's `kickoff_at > now()`                            |
| UPDATE    | `predictions_update_own_before_kickoff` (line 358) | Same as insert, applied to both `USING` and `WITH CHECK`.                          |
| DELETE    | _(no policy)_                                      | Effectively forbidden; users cannot delete predictions.                            |

The `kickoff_at > now()` check happens in Postgres against the database clock,
so client-side clock drift cannot bypass the lock. The server action maps the
resulting `42501` error to a friendly message:
[`app/(public)/matches/[matchId]/actions.ts:42`](<../app/(public)/matches/[matchId]/actions.ts>).

---

### `public.scores`

Derived table, rewritten by `compute_match_scores`. Users never write to it.
Source: [`supabase/migrations/20260513000000_init.sql:51`](../supabase/migrations/20260513000000_init.sql).

| Column        | Type                                 | Notes                                                       |
| ------------- | ------------------------------------ | ----------------------------------------------------------- |
| `user_id`     | `uuid not null`                      | FK → `profiles(id) on delete cascade`                       |
| `match_id`    | `uuid not null`                      | FK → `matches(id) on delete cascade`                        |
| `points`      | `smallint not null`                  | `check (points >= 0)`                                       |
| `hit_type`    | `text not null`                      | `check (hit_type in ('exact','winner_gd','winner','miss'))` |
| `computed_at` | `timestamptz not null default now()` |                                                             |
|               |                                      | `primary key (user_id, match_id)`                           |

#### Indexes

- `scores_match_id_idx` on `(match_id)` — speeds up the recompute's
  `DELETE WHERE match_id = …` step.

#### RLS policies

| Operation            | Policy                                   | Allows                                                        |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| SELECT               | `scores_select_authenticated` (line 382) | Any signed-in user reads any score.                           |
| INSERT/UPDATE/DELETE | _(none)_                                 | Only `compute_match_scores()` (security definer) writes here. |

---

## Functions

### `public.compute_match_scores(p_match_id uuid)`

Defined at [`supabase/migrations/20260513000000_init.sql:107`](../supabase/migrations/20260513000000_init.sql).
`SECURITY DEFINER`, runs with the schema owner's privileges so it can write to
`scores` despite the table's tight RLS.

Behaviour:

1. `DELETE FROM scores WHERE match_id = p_match_id` (always).
2. If the match is missing, not `'final'`, or has any null score → return
   (table stays empty for that match).
3. Otherwise: `INSERT INTO scores` one row per `predictions` row for that
   match, computing `points` and `hit_type` inline per the scoring rules.

Idempotent — running it twice in a row yields identical rows.

Exposed as an RPC: `grant execute on function public.compute_match_scores(uuid) to authenticated;`
(line 396). The admin "Force recompute" button calls it directly.

### `public.trg_recompute_scores()` (trigger function)

Defined at [`supabase/migrations/20260513000000_init.sql:156`](../supabase/migrations/20260513000000_init.sql).
Wraps the recompute so it only runs when a meaningful column changed:

```sql
if (tg_op = 'UPDATE' and (
      new.home_score is distinct from old.home_score
   or new.away_score is distinct from old.away_score
   or new.status     is distinct from old.status
)) or tg_op = 'INSERT' then
  perform public.compute_match_scores(new.id);
end if;
```

### `public.set_updated_at()`, `public.handle_new_user()`, `public.is_admin()`, `public.guard_profiles_is_admin()`

Plumbing functions described in their relevant table sections above.

---

## Leaderboard surfaces

### View: `public.v_leaderboard_overall`

Defined at [`supabase/migrations/20260513000000_init.sql:180`](../supabase/migrations/20260513000000_init.sql).
Returns one row per user with at least one `scores` row, ranked across the
whole tournament.

Columns:

| Column           | Type          | Meaning                                                          |
| ---------------- | ------------- | ---------------------------------------------------------------- |
| `user_id`        | `uuid`        |                                                                  |
| `display_name`   | `text`        | From `profiles`.                                                 |
| `total_points`   | `int`         | `SUM(scores.points)`                                             |
| `exact_hits`     | `int`         | `COUNT(*) FILTER (where hit_type = 'exact')`                     |
| `winner_gd_hits` | `int`         | `COUNT(*) FILTER (where hit_type = 'winner_gd')`                 |
| `winner_hits`    | `int`         | `COUNT(*) FILTER (where hit_type = 'winner')`                    |
| `first_submit`   | `timestamptz` | `MIN(predictions.submitted_at)` across the user's counted picks. |
| `rank`           | `bigint`      | `rank() OVER (...)` using the tie-break order below.             |

Tie-break ordering (in `ORDER BY`):

1. `total_points DESC`
2. `exact_hits DESC`
3. `winner_gd_hits DESC`
4. `first_submit ASC` — earliest submission wins.

`grant select on public.v_leaderboard_overall to anon, authenticated;` (line 394).

### Function: `public.leaderboard_for_day(d date, tz text default 'UTC')`

Defined at [`supabase/migrations/20260513000000_init.sql:208`](../supabase/migrations/20260513000000_init.sql).
Same column shape as `v_leaderboard_overall`, but scoped to matches whose
`kickoff_at` falls inside the calendar day `d` interpreted in IANA timezone
`tz`. Computed by clipping to UTC bounds:

```sql
(d::timestamp at time zone tz)        as day_start_utc,
((d + 1)::timestamp at time zone tz)  as day_end_utc
```

…and joining `scores` against `matches.kickoff_at >= day_start_utc AND
matches.kickoff_at < day_end_utc`. Tie-break ordering is identical to the
overall view.

`grant execute on function public.leaderboard_for_day(date, text) to anon, authenticated;` (line 395).

The leaderboard page passes the user's timezone (from the `tz` cookie set by
[`app/(public)/leaderboard/timezone-cookie.tsx`](<../app/(public)/leaderboard/timezone-cookie.tsx>))
and the requested date:
[`app/(public)/leaderboard/page.tsx:59`](<../app/(public)/leaderboard/page.tsx>).

---

## Grants summary

| Object                            | Grantee               | Privilege |
| --------------------------------- | --------------------- | --------- |
| `v_leaderboard_overall`           | `anon, authenticated` | `SELECT`  |
| `leaderboard_for_day(date, text)` | `anon, authenticated` | `EXECUTE` |
| `compute_match_scores(uuid)`      | `authenticated`       | `EXECUTE` |

All other table access goes through RLS.
