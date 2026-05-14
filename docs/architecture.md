# Architecture

A high-level reference for the World Cup 2026 Pool app: process boundaries,
data flow, scoring/recompute path, kickoff-lock enforcement, and cache
invalidation. For per-table column detail see [`data-model.md`](./data-model.md).
For the original design rationale see
[`openspec/changes/add-world-cup-2026-pool/design.md`](../openspec/changes/add-world-cup-2026-pool/design.md).

## Stack

- **Next.js 16** App Router (TypeScript, React 19). All read paths are
  React Server Components; all writes are server actions or route handlers.
- **Tailwind CSS 4** + **shadcn/ui** (primitives in `components/ui/**`, tagged
  with `data-slot` attributes).
- **Supabase** — Postgres + Auth (email magic link only) + RLS.
- **`@supabase/ssr`** for cookie-based session handling in the App Router.
- **Vercel** deployment; preview + production environments share the same
  Supabase project.

## Process boundaries

```
                                 +----------------------------+
                                 |  Supabase project           |
                                 |   - Postgres (RLS-on)       |
                                 |   - Auth (magic link)       |
                                 +-------------^--------------+
                                               |
                          anon JWT / user JWT  |  service_role
                                               |
+----------------+   request   +----------------------------+
|  Browser       |------------>|  Next.js (Vercel)           |
|  (RSC payload, |             |   middleware.ts (cookie     |
|   server-action|<------------|     refresh)                |
|   results)     |             |   RSC pages (anon/user JWT) |
+----------------+             |   server actions (admin =   |
                               |     service_role)            |
                               +----------------------------+
```

- **Three Supabase clients**, one per concern. They are not interchangeable —
  always pick the one matching the auth context.
  - `lib/supabase/server.ts` ([`lib/supabase/server.ts:6`](../lib/supabase/server.ts))
    — uses the **anon key** and the request's session cookie. All RLS checks
    run against the signed-in user (or anonymously). Use it inside RSCs and
    user-facing server actions.
  - `lib/supabase/browser.ts` ([`lib/supabase/browser.ts:5`](../lib/supabase/browser.ts))
    — same auth context but for client components (sign-in / sign-out flows).
  - `lib/supabase/admin.ts` ([`lib/supabase/admin.ts:6`](../lib/supabase/admin.ts))
    — service-role key, bypasses RLS. Tagged `import "server-only"` and only
    imported by admin server actions in `app/(admin)/admin/matches/actions.ts`.
- **`middleware.ts`** ([`middleware.ts:5`](../middleware.ts)) refreshes the
  Supabase session cookie on every non-static request. It does not enforce
  authorization — that is the job of layouts and RLS.

## Routing layout

The App Router groups isolate auth context but share the root layout:

| Route group            | Guard                                                                                                               | Purpose                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `app/(public)/**`      | none                                                                                                                | Match list, match detail, leaderboard, sign-in. Read-only for anonymous users.                 |
| `app/(auth)/**`        | none                                                                                                                | Sign-in form (`/sign-in`) and sign-out POST handler.                                           |
| `app/(app)/**`         | redirect to `/sign-in` if no user; redirect to `/onboarding` if no `display_name`                                   | Authenticated-only routes (`/my-picks`).                                                       |
| `app/(admin)/**`       | renders 403 if `profiles.is_admin = false` ([`app/(admin)/admin/layout.tsx:18`](<../app/(admin)/admin/layout.tsx>)) | Admin fixtures + results entry.                                                                |
| `app/onboarding/**`    | redirect to `/sign-in` if no user                                                                                   | Forces first-time users to set a display name. Lives outside `(app)` to avoid a redirect loop. |
| `app/auth/callback/**` | none                                                                                                                | Magic-link code → session exchange.                                                            |

## Data flow: read path

Server Component pages call `createServerSupabaseClient()` and query Postgres
directly. RLS scopes the result to what the requester is allowed to see — for
example, `predictions` only returns the caller's own rows (or all rows for
matches where `status = 'final'`).

```
Browser
   |
   v
RSC page  --->  createServerSupabaseClient()  --->  Postgres (anon|user JWT)
   |                                                  ^
   |                                                  |
   |                                       RLS evaluates auth.uid()
   |                                       against policies
   v
HTML stream / RSC payload
```

Cookie state arrives via `next/headers.cookies()`; the cookie is refreshed by
`middleware.ts` so the Supabase session never expires mid-request.

## Data flow: write path

User-facing writes go through server actions on the anon-keyed client, so RLS
applies. Admin writes use the service-role client, so they bypass RLS — server
actions in `app/(admin)/admin/matches/actions.ts` call `assertAdmin()` first
([`app/(admin)/admin/matches/actions.ts:39`](<../app/(admin)/admin/matches/actions.ts>))
to enforce the admin check at the application layer before issuing a
service-role write.

```
Form submit (server action)
   |
   v
+-------------------------------+
| User-facing: anon/user client | --> Postgres (RLS enforces auth.uid()
| (predictions, profile edits)  |                + kickoff window)
+-------------------------------+
   |
   v
+-------------------------------+
| Admin-only: service-role      | --> Postgres (RLS bypassed; the
| client + assertAdmin() guard  |      profiles.is_admin check happens
| (matches, results)            |      in the server action itself)
+-------------------------------+
```

## Kickoff lock (RLS layer)

The lock that prevents late prediction edits is enforced **in the database**,
not in the UI. The relevant policies on `public.predictions`
([`supabase/migrations/20260513000000_init.sql:347`](../supabase/migrations/20260513000000_init.sql))
require both `user_id = auth.uid()` AND a subquery proving
`kickoff_at > now()` for the referenced match. A client that bypasses the
form (or has a skewed clock) still gets `42501` from Postgres.

The server action translates that Postgres error code into the user-facing
"Predictions are locked — kickoff has passed" string at
[`app/(public)/matches/[matchId]/actions.ts:42`](<../app/(public)/matches/[matchId]/actions.ts>):

```ts
if (error.code === "42501" || /row-level security/i.test(error.message)) {
  return { ok: false, error: "Predictions are locked — kickoff has passed." };
}
```

The UI also disables the form once a 1-second client-side ticker sees
`Date.now() >= kickoff` ([`app/(public)/matches/[matchId]/prediction-form.tsx:28`](<../app/(public)/matches/[matchId]/prediction-form.tsx>)),
but that is a UX nicety; the RLS policy is the source of truth.

## Scoring trigger and recompute path

```
admin saves result
   |
   v
matches UPDATE (home_score / away_score / status)
   |
   v
trg_recompute_scores_on_match_change  (AFTER INSERT OR UPDATE)
   |
   v
public.compute_match_scores(p_match_id)
   |
   +-- DELETE FROM scores WHERE match_id = p_match_id
   |
   +-- If status='final' AND scores not null:
   |       INSERT INTO scores
   |       SELECT user_id, match_id, points, hit_type, now()
   |       FROM predictions
   |       WHERE match_id = p_match_id
   |       (points + hit_type computed inline; see SQL function)
   |
   v
server action calls revalidateTag('leaderboard', 'max')
   |
   v
next leaderboard render reads recomputed rows
```

- The recompute is **idempotent**: it always clears the match's existing
  `scores` rows first, then re-inserts based on the current result. Running
  it twice produces identical rows. (See migration line 117 and the
  scoring spec scenarios in
  [`openspec/changes/add-world-cup-2026-pool/specs/scoring/spec.md`](../openspec/changes/add-world-cup-2026-pool/specs/scoring/spec.md).)
- If `status` is anything other than `'final'`, the function returns without
  inserting — clearing a result (status → cancelled, scores → null) removes
  the match from the leaderboard.
- The same scoring logic exists as pure TypeScript in
  [`lib/scoring.ts`](../lib/scoring.ts) for unit testing
  (`tests/scoring.test.ts`). The SQL is the runtime source of truth; the TS
  replica exists so we can prove the rules without a database.
- An admin "Force recompute" button calls `compute_match_scores` directly via
  RPC ([`app/(admin)/admin/matches/actions.ts:114`](<../app/(admin)/admin/matches/actions.ts>))
  for use when scoring data drifted (e.g. after a bulk import or manual SQL
  edit).

### Scoring rules

| Hit type    | Points | Condition                                                                                 |
| ----------- | ------ | ----------------------------------------------------------------------------------------- |
| `exact`     | 5      | `home_goals == home_score` AND `away_goals == away_score`                                 |
| `winner_gd` | 3      | Correct winner (or correct draw) AND `home_goals - away_goals == home_score - away_score` |
| `winner`    | 1      | Correct winner (or correct draw) only                                                     |
| `miss`      | 0      | Wrong outcome                                                                             |

## Cache-tag invalidation

The leaderboard data is dynamic per-request today (it reads the auth cookie),
but the **invalidation hook is already wired** so we can swap in
`'use cache'` + `cacheTag('leaderboard')` later without changing call sites.
Every admin write that affects scores calls `revalidateTag('leaderboard', 'max')`:

- `saveFixture` — [`app/(admin)/admin/matches/actions.ts:82`](<../app/(admin)/admin/matches/actions.ts>)
- `setMatchResult` — [`app/(admin)/admin/matches/actions.ts:111`](<../app/(admin)/admin/matches/actions.ts>)
- `forceRecompute` — [`app/(admin)/admin/matches/actions.ts:121`](<../app/(admin)/admin/matches/actions.ts>)
- `deleteMatch` — [`app/(admin)/admin/matches/actions.ts:132`](<../app/(admin)/admin/matches/actions.ts>)

The `'max'` profile is Next.js 16's longest cache lifetime — appropriate
because we drive freshness via tag invalidation, not TTL.

## Timezone handling

- All timestamps are stored as `timestamptz` in UTC.
- The browser writes its IANA timezone to a `tz` cookie via the
  `TimezoneCookie` client component
  ([`app/(public)/leaderboard/timezone-cookie.tsx:5`](<../app/(public)/leaderboard/timezone-cookie.tsx>)).
- The leaderboard page reads that cookie server-side, defaults to `UTC`, and
  passes it into `leaderboard_for_day(d date, tz text)`
  ([`app/(public)/leaderboard/page.tsx:40`](<../app/(public)/leaderboard/page.tsx>)).
- Kickoff times render through the `<LocalTime>` client component
  (`components/local-time.tsx`) so the user always sees their local time
  after hydration.

## Auth flow

1. User submits their email on `/sign-in`.
2. Supabase Auth sends a magic-link email.
3. Clicking the link redirects back to `/auth/callback?code=...`.
4. `app/auth/callback/route.ts` exchanges the code for a session and sets
   the Supabase cookies.
5. The `auth.users` insert trigger (`trg_on_auth_user_created`,
   migration line 99) inserts a matching `public.profiles` row.
6. If `profiles.display_name IS NULL` the `(app)` layout redirects to
   `/onboarding`.

## Where things live

```
app/
  (public)/                   anonymous-readable
    matches/                  list + detail + prediction form
    leaderboard/              today / overall standings
  (auth)/sign-in/             magic-link sign-in
  (auth)/sign-out/            POST handler
  (app)/my-picks/             user's predictions
  (admin)/admin/matches/      fixtures + results entry
  onboarding/                 forces display name
  auth/callback/              magic-link code exchange
components/
  ui/                         shadcn primitives (data-slot)
  site-nav.tsx                global nav + footer
  local-time.tsx              ISO -> user-timezone time
lib/
  supabase/{server,browser,admin}.ts
  database.types.ts           generated; do not hand-edit
  db.ts                       narrowed aliases on top of generated types
  scoring.ts                  TS replica of compute_match_scores (tested)
  match-utils.ts              isLocked, stage/status labels
  env.ts                      fail-fast env loader + siteUrl resolution
supabase/
  migrations/20260513000000_init.sql
  seed/{matches,admin}.sql
tests/
  scoring.test.ts             vitest unit tests
```
