# World Cup 2026 Pool

A single-page pool for the FIFA World Cup 2026: every signed-in user submits an exact-score
prediction for each match, picks lock at kickoff, and a daily / overall leaderboard ranks
everyone in one global pool.

- **Stack:** Next.js 16 (App Router), TypeScript, Tailwind 4, shadcn/ui, Supabase (Postgres + Auth + RLS).
- **Spec:** see `openspec/changes/add-world-cup-2026-pool/` (proposal, design, specs, tasks).

---

## Local development

```bash
pnpm install
cp .env.example .env.local      # then fill in real Supabase keys
pnpm dev
```

Open <http://localhost:3000>. The dev server fails fast at module load if any of
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY`
is missing.

### Scripts

| command | purpose |
|---|---|
| `pnpm dev` | Next dev server with Turbopack. |
| `pnpm build` | Production build. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm lint` | ESLint. |
| `pnpm test` | Vitest unit tests (scoring rules). |
| `pnpm format` | Prettier write. |

---

## First-time setup (operator runbook)

1. **Create a Supabase project** at <https://supabase.com/dashboard>. Copy the project URL,
   the `anon` key, and the `service_role` key into your `.env.local` and (later) into Vercel.
2. **Link the Supabase CLI** to that project:
   ```bash
   supabase login
   supabase link --project-ref <YOUR-PROJECT-REF>
   ```
3. **Apply the schema migration:**
   ```bash
   supabase db push
   ```
   This applies `supabase/migrations/20260513000000_init.sql` — tables, RLS policies,
   triggers, scoring function, leaderboard view, etc.
4. **Regenerate the TypeScript types** (optional but recommended; replaces the hand-written
   stub):
   ```bash
   supabase gen types typescript --linked > lib/database.types.ts
   ```
5. **Load fixtures.** Edit `supabase/seed/matches.sql` and replace the placeholder rows with
   the official FIFA 2026 fixture list (104 matches). Then run it against the project:
   ```bash
   psql "$DATABASE_URL" -f supabase/seed/matches.sql
   ```
   …or paste it into the Supabase SQL editor.
6. **Sign in once.** Visit the deployed app and sign in with your owner email — this
   creates a row in `auth.users` plus an empty `public.profiles` row via the trigger.
7. **Promote yourself to admin.** Edit `supabase/seed/admin.sql`, replace
   `OWNER_EMAIL@example.com` with your address, and run it (service-role required — use the
   Supabase SQL editor).
8. The "Admin" link now appears in the nav. Use it to enter results during the tournament.

---

## Day-to-day operations

### Add or edit a fixture

Sign in as admin → "Admin" → "New fixture" form, or use the per-match form on the same page.
Saves go straight to Postgres via a server action using the service-role key.

### Enter a final score

On the same admin page, find the fixture, fill home/away scores, set status to **final**,
hit "Save result". The `trg_recompute_scores_on_match_change` trigger recomputes every
prediction's points instantly, and `revalidateTag('leaderboard', 'max')` invalidates the
cached standings.

If you need to recompute manually (e.g. you bulk-imported predictions or hand-edited the
`scores` table), use the "Force recompute scores" button — it calls
`public.compute_match_scores(match_id)` via RPC.

### Correct a result

Edit the score on the admin page and save again. The trigger replaces the previous rows
in `scores` — the leaderboard reflects the correction within one request.

### Add another admin

Sign that person in once (so they exist in `auth.users`), then run an `UPDATE` in the
Supabase SQL editor:

```sql
update public.profiles
   set is_admin = true
 where id = (select id from auth.users where email = 'new-admin@example.com');
```

---

## Deploy

1. **Push to GitHub.** (If you haven't already; create-next-app already ran `git init`.)
2. **Import the repo into Vercel.** Project root = repo root.
3. **Set environment variables** in the Vercel project settings (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — keep it secret)
   - `NEXT_PUBLIC_SITE_URL` (your production domain, e.g. `https://wcpool.example.com`)
4. **Update Supabase Auth → URL Configuration:**
   - Site URL: your production URL.
   - Additional Redirect URLs: `https://YOUR-DOMAIN/auth/callback` and (for previews)
     `https://*.vercel.app/auth/callback`.
5. **Trigger a production deployment** and smoke-test sign-in, prediction submit, admin
   result entry, leaderboard refresh.

---

## How scoring works

| Hit | Points | Description |
|---|---|---|
| `exact` | 5 | Both teams' goal counts match. |
| `winner_gd` | 3 | Correct winner (or correct draw) AND correct goal difference. |
| `winner` | 1 | Correct winner only. |
| `miss` | 0 | Wrong winner. |

**Tie-breakers** (in order): more exact hits, then more `winner_gd` hits, then earlier
`submitted_at` of the user's most recent counted prediction.

**Lock rule:** the `predictions` RLS policy compares `kickoff_at > now()` at the database
layer, so late writes are refused even if the UI is bypassed.

---

## Where things live

```
app/
  (public)/matches/              public match list + detail + prediction form
  (public)/leaderboard/          today / overall standings
  (auth)/sign-in/                magic-link + Google sign-in
  (auth)/sign-out/               POST sign-out
  (app)/my-picks/                authed: list of own picks
  (admin)/admin/matches/         admin: fixtures + results
  onboarding/                    forces display name on first sign-in
  auth/callback/                 OAuth/magic-link code exchange
  page.tsx                       landing
  how-it-works/                  scoring + tie-breaker docs
components/
  ui/                            shadcn primitives
  site-nav.tsx                   global nav + footer
  local-time.tsx                 ISO → user-timezone time component
lib/
  supabase/{server,browser,admin}.ts   Supabase clients
  database.types.ts              hand-written DB types (regen after linking)
  scoring.ts                     TS replica of compute_match_scores (unit-tested)
  match-utils.ts                 stage / status labels, lock check
supabase/
  migrations/20260513000000_init.sql   schema + RLS + triggers + scoring fn + views
  seed/matches.sql               fixture seed (REPLACE placeholders before launch)
  seed/admin.sql                 promote owner to admin
tests/
  scoring.test.ts                Vitest unit tests for scoring rules
```
