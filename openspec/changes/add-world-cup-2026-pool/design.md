## Context

Greenfield project. No existing code or schemas to consider. The product is a single-tenant web app for one global World Cup 2026 prediction pool. Expected scale is modest (hundreds to low thousands of authenticated users) and traffic peaks around match kickoffs (104 matches over ~6 weeks, June 11 – July 19, 2026). Stakeholders: end users (predictors), one or more admins (results entry), and the maintainer (deployment, schema changes).

Constraints:
- Tournament starts 2026-06-11. App must be usable for picks at least 1 week before kickoff of the first match (target ready-for-users date: 2026-06-04).
- Hosting and budget favor Vercel + Supabase free tiers initially.
- Predictions must be **immutable** once a match starts to prevent late-edit cheating.
- Scoring must be deterministic and re-runnable when an admin corrects a final score.

## Goals / Non-Goals

**Goals:**
- Authenticated, single global pool with daily and overall leaderboards.
- Exact-score predictions locked at kickoff, with documented scoring + tie-break rules.
- Admin-only fixture and final-score management (no public-facing admin needed).
- Server-side authorization via Supabase Row-Level Security so no business rule depends solely on UI checks.
- Recompute leaderboard on demand without manual SQL after an admin score edit.
- Mobile-first responsive UI; users will mostly submit picks from phones.

**Non-Goals:**
- Private leagues / multiple pools (single global pool only — explicit per proposal).
- Automatic results ingestion from a public football API (admin manual entry only).
- Bracket-style picks, top scorer, or tournament-winner side bets (per-match exact-score only).
- Real-time push updates (live websocket leaderboard). A page refresh / poll is sufficient.
- Native mobile apps.
- Payments, paid entry, or prize distribution.

## Decisions

### 1. Framework: Next.js 16 (App Router) on Vercel
- **Why**: Server Components let auth + RLS-protected queries run server-side without leaking the Supabase service role; built-in route handlers cover admin mutations; Vercel preview deployments speed iteration.
- **Alternatives**: Remix (good but Supabase SSR helpers are most mature for Next.js); SvelteKit (smaller ecosystem of shadcn-equivalent components for the time budget).

### 2. Backend / DB / Auth: Supabase
- **Why**: One managed Postgres + Auth + Storage; first-class RLS; `@supabase/ssr` integrates cleanly with App Router cookies; generous free tier covers expected volume.
- **Alternatives**: Neon Postgres + NextAuth (more wiring for auth-to-DB user mapping, no built-in RLS workflow); Firebase (NoSQL doesn't fit relational match/prediction model).

### 3. Authentication method: Email magic link + Google OAuth
- **Why**: Magic link avoids password management; Google OAuth is one click and most users already have an account. Both surfaced via Supabase Auth UI with our own styled form.
- **Alternatives**: Email+password (extra surface area for reset/forgot flows we don't need); anonymous-only (can't reliably identify users across devices for ranking).

### 4. Data model (Postgres tables, all in `public` schema)

```
profiles
  id              uuid PK references auth.users(id) on delete cascade
  display_name    text not null check (char_length(display_name) between 2 and 32)
  is_admin        boolean not null default false
  created_at      timestamptz not null default now()

matches
  id              uuid PK default gen_random_uuid()
  stage           text not null check (stage in ('group','r32','r16','qf','sf','third','final'))
  group_code      text                              -- 'A'..'L' or null for knockout
  home_team       text not null
  away_team       text not null
  kickoff_at      timestamptz not null
  venue           text
  home_score      smallint                          -- null until admin enters final
  away_score      smallint                          -- null until admin enters final
  status          text not null default 'scheduled'  -- scheduled|live|final|cancelled
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()

predictions
  id              uuid PK default gen_random_uuid()
  user_id         uuid not null references profiles(id) on delete cascade
  match_id        uuid not null references matches(id) on delete cascade
  home_goals      smallint not null check (home_goals between 0 and 20)
  away_goals      smallint not null check (away_goals between 0 and 20)
  submitted_at    timestamptz not null default now()
  unique (user_id, match_id)

scores                                              -- materialized per (user, match) for fast leaderboard
  user_id         uuid not null references profiles(id) on delete cascade
  match_id        uuid not null references matches(id) on delete cascade
  points          smallint not null
  hit_type        text not null check (hit_type in ('exact','winner_gd','winner','miss'))
  computed_at     timestamptz not null default now()
  primary key (user_id, match_id)
```

- **Why split `predictions` from `scores`**: predictions are user-owned input, immutable after kickoff; scores are derived and rewritten whenever the admin edits a match result. Splitting keeps the audit trail clean and makes recompute idempotent.
- **Why store `display_name` in `profiles`** (separate from `auth.users`): RLS-friendly, customisable, and lets users change it without touching auth.

### 5. Scoring rules and recompute
- Exact score (both goals match): **5 points**, `hit_type='exact'`.
- Correct winner + correct goal difference (e.g., 2-1 predicted, 3-2 actual): **3 points**, `hit_type='winner_gd'`.
- Correct winner only (or correct draw without exact score): **1 point**, `hit_type='winner'`.
- Otherwise: **0 points**, `hit_type='miss'`.
- Implemented as a Postgres function `compute_match_scores(match_id uuid)` that deletes existing rows in `scores` for that match and re-inserts from `predictions` joined with the final result. Called via an `AFTER UPDATE` trigger on `matches` when `status` transitions to `'final'` or `home_score`/`away_score` change. Also exposed as an RPC the admin UI can invoke for force-recompute.
- **Why a SQL function and trigger** (vs application-side): keeps scoring as a single source of truth, runs inside the transaction, and is unaffected by which client edits the match.

### 6. Pick-locking rule
- RLS policy on `predictions`: `INSERT`/`UPDATE` allowed only when `auth.uid() = user_id` **and** `(select kickoff_at from matches where id = match_id) > now()`. Once kickoff passes, the database itself refuses writes — no UI-only enforcement.
- Server actions return a friendly error when the policy blocks; UI also disables the form when the countdown reaches zero.

### 7. Leaderboard query
- Overall: `select user_id, sum(points) as total, count(*) filter (where hit_type='exact') as exacts, count(*) filter (where hit_type in ('exact','winner_gd')) as winners_gd, min(submitted_at) as first_submit from scores join predictions using (user_id, match_id) group by user_id order by total desc, exacts desc, winners_gd desc, first_submit asc`.
- Daily: same query with a `where matches.kickoff_at::date = :day` join. Day is resolved in the **user's timezone** (sent from client as `Intl.DateTimeFormat().resolvedOptions().timeZone`); server converts to UTC bounds.
- Wrapped in a Postgres view `v_leaderboard_overall` and a parameterised SQL function `leaderboard_for_day(d date, tz text)` for clean caching.

### 8. Caching / freshness
- Leaderboard pages use Next.js Cache Components (`'use cache'` with `cacheTag('leaderboard')`). Admin score-update server action calls `revalidateTag('leaderboard')`.
- Match list page also tagged so admin fixture edits invalidate it.
- No long TTL — tags are the invalidation mechanism.

### 9. Admin authorization
- Server-side check `profiles.is_admin = true` for any admin route handler / server action. The first user to sign up is seeded as admin via a one-shot SQL script committed in `supabase/seed.sql` (project-owner email hard-coded in seed comment, applied manually post-deploy).
- RLS denies non-admins from `UPDATE/INSERT/DELETE` on `matches`; `SELECT` is public.

### 10. Timezone handling
- All timestamps stored in UTC (`timestamptz`).
- Server renders kickoff times with a `<time>` element carrying ISO UTC; client component formats to the browser's local timezone after hydration. Avoids flash-of-server-tz on first render by also rendering a UTC label until the client takes over.

## Risks / Trade-offs

- **Single global pool can't be reverted to private leagues without schema work** → Mitigation: design `predictions` and `scores` PK to already include `user_id`; adding a `pool_id` column later is straightforward and non-breaking.
- **Admin manual entry creates a delay between match end and leaderboard refresh** → Mitigation: post-match admin can update score in <60s; revalidateTag keeps UI fresh; users see "Awaiting result" placeholder. Acceptable for v1.
- **`@supabase/ssr` cookie handling pitfalls in Server Components** → Mitigation: follow the official Supabase Next.js guide; never call `getSession()` in Server Components, use `getUser()` + RLS only.
- **Late-arriving picks via clock skew** → Mitigation: kickoff comparison happens in the database (`now()`), not the client, so client-side clock drift cannot bypass the lock.
- **Recompute scoring on a match edit briefly invalidates leaderboard cache for everyone** → Mitigation: `compute_match_scores` plus `revalidateTag` is fast (104 matches, predictions per user, well under 100ms); acceptable. If it grows, move to per-day cache tags.
- **No automated results ingestion means missing/late admin entry blocks rankings** → Mitigation: explicit non-goal in v1; document operational runbook for admin in `README.md`.

## Migration Plan

1. Create Supabase project; run schema migration (`supabase/migrations/0001_init.sql`) defining all tables, RLS policies, scoring function, trigger, and leaderboard view/function.
2. Seed `matches` from the official FIFA 2026 fixtures CSV (committed in repo as `supabase/seed/matches.sql`).
3. Mark project owner admin via `supabase/seed/admin.sql` after first sign-in.
4. Deploy Next.js app to Vercel with Supabase env vars pulled via Vercel ↔ Supabase Marketplace integration.
5. Smoke-test on a preview deployment with two test accounts: sign-in → submit picks → admin enters fake result → leaderboard updates.
6. Promote to production. No rollback complexity since v1 is greenfield — if a defect ships, redeploy a previous Vercel deployment and re-run any corrective migration.

## Open Questions

- Should we send email notifications (24 h before tournament, daily summary)? Decision deferred; not in v1 scope.
- How are tie-breakers communicated to users? (Decision: document on a static "How scoring works" page; no UI tooltip.)
- Should the daily leaderboard include matches with `status='final'` only, or also `live`? (Decision: include `final` only — predictions for live matches haven't scored yet.)
