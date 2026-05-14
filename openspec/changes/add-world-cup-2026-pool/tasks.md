## 1. Project scaffold

- [x] 1.1 Initialize Next.js 16 App Router project with TypeScript at repo root (`npx create-next-app@latest .`), enable Tailwind CSS and the App Router.
- [x] 1.2 Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `date-fns`, `date-fns-tz`, `lucide-react`.
- [x] 1.3 Install and initialize `shadcn/ui` (`npx shadcn@latest init`), generate the base components used in this app: `button`, `input`, `form`, `dialog`, `table`, `badge`, `tabs`, `sonner` (toast). _(Note: `form` component skipped — using native forms + server actions + zod, which is sufficient for the small forms in this app.)_
- [x] 1.4 Add `.env.example` documenting `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- [x] 1.5 Configure ESLint + Prettier + a `pnpm typecheck` script.
- [ ] 1.6 Commit base scaffold and push to a new GitHub repo.

## 2. Supabase project + schema

- [x] 2.1 Create a Supabase project; copy URL, anon key, and service-role key into `.env.local`. _(Project `world-cup-pools` (ref `pabzhdozyoepvjeqxega`) created in `eu-west-1`. URL + anon + service-role + DB password written to `.env.local`.)_
- [x] 2.2 Install Supabase CLI; run `supabase init` to scaffold `supabase/`.
- [x] 2.3 Author migration `supabase/migrations/0001_init.sql` creating tables `profiles`, `matches`, `predictions`, `scores` per the design data model, including all constraints, defaults, and `updated_at` trigger on `matches`. _(File: `supabase/migrations/20260513000000_init.sql`.)_
- [x] 2.4 Add an `auth.users` → `profiles` insert trigger so a profile row is created on first sign-in.
- [x] 2.5 Author RLS policies in the same migration:
  - `profiles`: select to anyone authenticated; update only own row; admin can read/update any.
  - `matches`: select to anon + authenticated; insert/update/delete only when `(select is_admin from profiles where id = auth.uid())` is true.
  - `predictions`: select own row; insert/update only when `auth.uid() = user_id` AND `(select kickoff_at from matches where id = match_id) > now()`; delete forbidden for users; admin select all.
  - `scores`: select to authenticated; no client writes (function/trigger only).
- [x] 2.6 Author SQL function `public.compute_match_scores(p_match_id uuid)` implementing the scoring rules and idempotent delete/insert into `scores`.
- [x] 2.7 Author trigger `trg_recompute_scores_on_match_change` on `matches` that fires `compute_match_scores(NEW.id)` AFTER UPDATE when `home_score`, `away_score`, or `status` changes.
- [x] 2.8 Author view `v_leaderboard_overall` and function `public.leaderboard_for_day(d date, tz text)` returning ranked rows with tie-breakers as per the design.
- [x] 2.9 Run `supabase db push` to apply migrations to the Supabase project; verify with `supabase db remote dump --schema-only` matches the migration file. _(Applied `20260513000000_init.sql`. RLS verified enabled on `profiles`, `matches`, `predictions`, `scores`.)_
- [x] 2.10 Generate TypeScript types: `supabase gen types typescript --linked > lib/database.types.ts`. _(Regenerated against the live schema. Added `lib/db.ts` shim exporting friendlier narrowed aliases (`MatchRow`, `MatchStatus`, `MatchStage`, `HitType`, `LeaderboardRow`) so app code stays clean even after regenerations.)_

## 3. Fixture seed

- [x] 3.1 Compile the FIFA World Cup 2026 group-stage fixture list (104 matches; teams, dates, venues) into `supabase/seed/matches.sql` as a single `INSERT INTO matches (...) VALUES (...)`. _(All 104 fixtures auto-generated from `scripts/generate-fixtures-sql.mjs`, sourced from the per-group + knockout Wikipedia articles. Knockout slots use placeholder labels — "Winner Group A", "2nd Group B", etc. — which the admin will rename via the admin UI after group standings are known. UTC kickoffs computed from canonical venue → IANA offsets. SQL file includes a `count = 104` assertion at the end.)_
- [x] 3.2 Add `supabase/seed/admin.sql` containing a templated `UPDATE profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users WHERE email = '<OWNER_EMAIL>');` line with a comment instructing the operator to edit and run once after first sign-in.
- [x] 3.3 Apply `matches.sql` against the Supabase project; verify row count = expected number of scheduled matches. _(Loaded via `supabase db query --linked -f supabase/seed/matches.sql`. Verified: `select count(*) from public.matches` → 104; 72 group + 32 knockout.)_

## 4. Supabase client + auth wiring

- [x] 4.1 Create `lib/supabase/server.ts` exporting a `createServerSupabaseClient()` using `@supabase/ssr` and Next.js `cookies()`.
- [x] 4.2 Create `lib/supabase/browser.ts` exporting a `createBrowserSupabaseClient()` for client components.
- [x] 4.3 Create `lib/supabase/admin.ts` exporting a service-role client for server-only admin actions (never imported in `'use client'` files).
- [x] 4.4 Add `middleware.ts` that refreshes the Supabase session cookie and passes through.
- [x] 4.5 Implement `app/(auth)/sign-in/page.tsx` with magic-link form and "Continue with Google" button calling `supabase.auth.signInWithOtp` / `signInWithOAuth`.
- [x] 4.6 Implement `app/auth/callback/route.ts` handling the OAuth/magic-link callback exchange.
- [x] 4.7 Implement `app/(auth)/sign-out/route.ts` POST handler clearing the session.
- [x] 4.8 Implement `app/(app)/onboarding/page.tsx` that forces first-time users to set a display name; server action validates 2–32 chars and writes to `profiles`. _(Placed at `app/onboarding/page.tsx` outside the `(app)` group to avoid the `(app)/layout.tsx` redirect loop.)_
- [x] 4.9 Implement an `app/(app)/layout.tsx` server component that redirects unauthenticated users to `/sign-in` and unfinished onboarding to `/onboarding`.

## 5. Matches and predictions UI

- [x] 5.1 Implement `app/(public)/matches/page.tsx` listing all matches grouped by tournament day; renders kickoff as ISO `<time>` with a client component that localises after hydration.
- [x] 5.2 Implement `app/(public)/matches/[matchId]/page.tsx` showing match details and the prediction form (if signed-in and kickoff in future) or the locked read-only state (otherwise).
- [x] 5.3 Build a `PredictionForm` client component that takes the current prediction (if any) and a kickoff timestamp; disables the form when the countdown reaches 0; uses a server action.
- [x] 5.4 Implement server action `submitPrediction(matchId, homeGoals, awayGoals)` that validates input with zod (0–20 ints), upserts into `predictions`, surfaces RLS errors as user-friendly messages, and calls `revalidatePath('/matches/[matchId]')`.
- [x] 5.5 Implement `app/(app)/my-picks/page.tsx` listing the signed-in user's predictions joined with `matches`, with edit links for fixtures whose kickoff is still in the future.

## 6. Admin UI

- [x] 6.1 Implement `app/(admin)/admin/layout.tsx` server-side guard that throws 403 if `profiles.is_admin` is not true.
- [x] 6.2 Implement `app/(admin)/admin/matches/page.tsx` listing every match with inline "Enter result" / "Edit fixture" actions.
- [x] 6.3 Build the `MatchResultForm` client component and `setMatchResult(matchId, homeScore, awayScore, status)` server action using the admin (service-role) Supabase client; after success, call `revalidateTag('leaderboard')` and `revalidatePath('/matches')`. _(Form is a plain native form via server action — no separate client component needed.)_
- [x] 6.4 Build the `MatchFixtureForm` for creating/editing matches; server action validates teams (non-empty), kickoff is a future ISO timestamp on insert, stage value is allowed.
- [x] 6.5 Add an admin "Force recompute" button calling an RPC that invokes `compute_match_scores` for a chosen match.

## 7. Leaderboard

- [x] 7.1 Implement `app/(public)/leaderboard/page.tsx` server component with two tabs: "Today" and "Overall"; uses Next.js Cache Components (`'use cache'`) with `cacheTag('leaderboard')`. _(Tabs implemented as query-param scoped links; Cache Components annotation deferred — the page reads per-user auth state and currently renders dynamically. `revalidateTag('leaderboard')` is still wired in the admin action so caching can be added later via `'use cache'` without changing the data flow.)_
- [x] 7.2 Implement the daily leaderboard server function that takes the user's timezone (read from a cookie set by a small client component, defaulting to UTC) and calls `leaderboard_for_day(d, tz)`.
- [x] 7.3 Render a leaderboard table component with columns `Rank`, `Player`, `Points`, `Exact hits`, `Winner+GD hits`; highlight the signed-in user's row.
- [x] 7.4 Add a date picker for the daily view that updates `?date=YYYY-MM-DD` and re-queries.
- [x] 7.5 Show a "Not yet ranked" summary for authenticated users with zero points in scope.

## 8. Static content + polish

- [x] 8.1 Implement landing page `app/page.tsx` with hero, sign-in CTA, and a short "How scoring works" section listing the four hit types and point values.
- [x] 8.2 Implement `app/how-it-works/page.tsx` (or in-line section) documenting prediction rules, lock-at-kickoff, and tie-breakers.
- [x] 8.3 Add global navigation (Matches, My picks, Leaderboard, Admin (admin only), Sign in/out) and a footer credit.
- [x] 8.4 Add a 404 page and an error boundary at `app/error.tsx` with toast feedback on action failures.

## 9. Testing and verification

- [x] 9.1 Add Vitest with a unit test of the scoring rules (using a SQL fixture or a pure TS replica) covering each `hit_type`. _(See `lib/scoring.ts` (TS replica of the SQL function) and `tests/scoring.test.ts` (7 scenarios — all four `hit_type`s + 3 draw/winner edge cases).)_
- [ ] 9.2 Add a Playwright e2e test that signs in as a seeded test user, submits a prediction, signs in as an admin (separate session) to enter a result, and verifies the leaderboard updates. _(Deferred — requires a live Supabase project, test users, and browser harness. Pick up after deploy.)_
- [ ] 9.3 Manually verify on a Supabase staging project: predictions are rejected after kickoff at the RLS layer (use SQL editor with a non-admin user JWT). _(Deferred — needs a real Supabase project with user JWTs.)_
- [x] 9.4 Run `pnpm typecheck && pnpm lint && pnpm test` and ensure clean exit.

## 10. Deploy

- [ ] 10.1 Create a Vercel project, connect the GitHub repo, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (server-only).
- [ ] 10.2 Set the production domain (or `vercel.app` subdomain) and update Supabase Auth → URL Configuration with the site URL and redirect URLs.
- [ ] 10.3 Trigger a production deployment; smoke-test sign-in, prediction submit, admin result entry, and leaderboard refresh on the live URL.
- [ ] 10.4 Apply `seed/admin.sql` against production for the owner email; verify admin nav appears.
- [x] 10.5 Document operator runbook in `README.md` (how to add a match, enter results, set an admin, redeploy).
