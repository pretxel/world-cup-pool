## Why

The FIFA World Cup 2026 (48 teams, 104 matches across USA, Canada, Mexico) is a major social event where friends compete on score predictions, but there is no purpose-built, web-based pool that scores exact-score predictions, locks picks at kickoff, and surfaces a live daily ranking. Existing options are spreadsheets (manual, error-prone) or generic bracket apps (no exact-score scoring, no daily leaderboard view). We are starting from an empty repo and need a focused product before the tournament starts on June 11, 2026.

## What Changes

- New Next.js (App Router) web app deployed on Vercel.
- New Supabase project hosting Postgres database, Auth (email + magic link / OAuth), and Row-Level Security policies.
- Single global pool: every authenticated user automatically participates in one shared competition.
- Account system: users sign up, sign in, set a display name, and view their own profile/picks.
- Match catalog: admin-curated fixtures for all 104 World Cup 2026 matches (group stage + knockout) with kickoff time in UTC.
- Predictions: each authenticated user submits an exact score (home goals, away goals) per match; picks lock at kickoff time and become read-only.
- Admin role: designated user(s) can enter/edit final scores after a match finishes and CRUD match fixtures.
- Scoring engine: deterministic points per match — exact score, correct winner + goal difference, correct winner only, otherwise zero. Points recompute when admin updates a final score.
- Daily ranking view: leaderboard scoped to "today" (matches played on the selected calendar day, in user's timezone) plus an overall tournament ranking. Default view is today's date.
- Tie-breakers in ranking: total points → exact-score hits → correct-winner hits → earliest submission timestamp.
- Public read-only pages for the global leaderboard and per-match results; authenticated pages for submitting/editing picks.

## Capabilities

### New Capabilities
- `accounts`: User registration, sign-in, sessions, display name, and admin role flag backed by Supabase Auth.
- `matches`: Admin-managed catalog of World Cup 2026 fixtures, kickoff times, group/stage metadata, and final scores.
- `predictions`: Authenticated users submit and edit exact-score predictions per match; picks lock at kickoff.
- `scoring`: Deterministic points calculation per prediction, recomputed when final scores change.
- `leaderboard`: Daily and overall ranking views with documented tie-breakers, scoped to the single global pool.

### Modified Capabilities
<!-- None: empty repository, no existing specs to modify. -->

## Impact

- New repository scaffold: Next.js 16 App Router (TypeScript), Tailwind CSS, shadcn/ui, `@supabase/ssr` for cookie-based auth.
- New Supabase project: schema migrations for `profiles`, `matches`, `predictions`, `scores`; RLS policies; SQL function/trigger for scoring recompute.
- New environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only for admin actions).
- New Vercel project linked to repo for preview + production deployments.
- No existing code, APIs, or consumers are affected — greenfield project.
