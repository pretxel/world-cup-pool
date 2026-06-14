## Context

The landing page (`app/[locale]/page.tsx`) renders `<TournamentCountdown />`, a server
component that, at request time, flips between two branches:

- **Pre-tournament**: a `KickoffCountdown` to the opening match.
- **Live** (`kickoff <= now`): a static "Tournament live" pill + a generic subhead.

The live branch currently shows no real fixtures. Matches live in the existing `matches`
table (`lib/database.types.ts`): `home_team`, `away_team`, `home_score`, `away_score`,
`kickoff_at`, `status` (`scheduled | live | final | cancelled`), `stage`, `group_code`,
`venue`, `competition_id`. The active competition is resolved via `getActiveCompetition()`
(`lib/competition.ts`, wrapped in React `cache()`). Data is read server-side with
`createServerSupabaseClient()` (`lib/supabase/server.ts`). There is no client-side polling
anywhere yet; results are synced by a cron route (`app/api/cron/sync-matches/route.ts`) and
admin actions. Reusable UI exists: `MatchStateBadge`, `TeamFlag`, `KickoffCountdown`,
`LocalTime`. i18n is `next-intl` with `messages/{en,es,fr}.json` under the `home` namespace.

Constraint: this Next.js build has breaking changes vs. common knowledge — consult
`node_modules/next/dist/docs/` before writing route handlers / client components.

## Goals / Non-Goals

**Goals:**
- Show who is playing live in the existing "Tournament live" section: teams + flags, live
  score, "Live" badge, each fixture linking to its match page.
- Keep scores current via lightweight ~30s polling that pauses on hidden tabs and stops
  when nothing is live.
- Never show an empty section during the tournament: fall back to the next upcoming fixture
  with a kickoff countdown.
- Preserve the existing pre-tournament countdown behavior exactly.

**Non-Goals:**
- Live minute/clock, possession, lineups, or any data not already in `matches`.
- Supabase Realtime / WebSocket subscriptions (polling is sufficient and simpler).
- Changing the results sync pipeline, schema, or admin flows.
- Showing live fixtures anywhere other than the landing page.

## Decisions

### 1. Server-rendered first paint, client poller for updates
The live branch of `TournamentCountdown` fetches the initial live + next-up fixtures on the
server (no loading flash, SEO-friendly) and passes them as `initialData` to a new
`"use client"` component `LiveMatchList`. That component owns the polling loop and re-renders
on each refresh.
- _Alternative — fully client-fetched (skeleton on mount):_ rejected; adds a loading flash
  and loses server-rendered content for a section that is often the first thing seen.

### 2. Data source for polling: a GET route handler returning JSON
Add `app/api/live-matches/route.ts` (GET) returning `{ live: Fixture[], nextUp: Fixture | null }`
for the active competition, with `Cache-Control: no-store` (or a short `s-maxage`). The
client polls this with `fetch`.
- _Alternative — Server Action called on an interval:_ works, but actions are POST-only and
  less natural for idempotent reads / caching; a plain GET endpoint is the conventional fit
  and easy to test with `curl`.
- A shared query helper (e.g. `lib/matches/live.ts`) is used by BOTH the server component
  and the route handler so the shape and filter logic live in one place.

### 3. "Live" selection logic (single source of truth)
A fixture is **live** when `status = "live"`, OR (`kickoff_at <= now` AND `status` not in
`final`/`cancelled`) — mirroring the existing `lockReason` kickoff rule so the landing page
agrees with match locking. **Next-up** is the soonest `status = "scheduled"` fixture with
`kickoff_at > now`. Both are scoped to the active competition and ordered by `kickoff_at`.
Placeholder knockout rows (no resolvable flag, per `looksLikeRealFixture` in the existing
countdown) are excluded from next-up so the card never reads like "Winner R32-1".

### 4. Polling cadence and lifecycle
Poll every 30s via `setInterval`. Pause when `document.visibilityState === "hidden"` and
fetch once immediately on becoming visible again. Stop polling entirely once a response
contains zero live fixtures AND the next-up kickoff is still in the future by more than the
interval (re-arm near kickoff). Abort in-flight requests on unmount with `AbortController`.

### 5. Rendering
`LiveMatchList` renders a compact responsive list/grid of fixture rows reusing
`MatchStateBadge status="live"`, `TeamFlag`, and a monospace `home–away` score. The next-up
fallback reuses `KickoffCountdown`. Section heading + copy come from new `home` i18n keys.
Each row is a `next/link` to the match page; the score uses `aria-live="polite"` so updates
are announced to screen readers.

## Risks / Trade-offs

- **Polling load on Supabase** → cap with a single small indexed query per poll, short
  result set (filtered to active competition), and stop-when-idle logic; optionally a short
  CDN `s-maxage` on the route to coalesce bursts.
- **Server/client time skew for the kickoff rule** → the authoritative live decision is made
  server-side in the route handler on each poll, not on the client clock; the client only
  renders what the endpoint returns (countdown component already handles its own ticking).
- **Stale scores between polls (≤30s)** → acceptable for a pools product; the "Live" badge
  signals data is in motion. Cadence is a single constant, easy to tune.
- **Hydration mismatch from `Date.now()` in the live branch** → keep the request-time
  branch decision server-only and mark intentional impurity as the existing component does;
  the client component receives concrete data, not a time-derived branch.
- **No live data during a quiet window** → next-up fallback guarantees the section always
  has content while the tournament is on.

## Migration Plan

Additive only. New files (route handler, client list component, query helper) + edits to
`TournamentCountdown` live branch and message files. No schema or data migration. Rollback =
revert the commit; the live branch falls back to its current static pill.

## Open Questions

- Final poll interval (30s assumed) — confirm against expected traffic / Supabase quota.
- Max number of simultaneous live fixtures to display before truncating with a "view all on
  /matches" link (World Cup group stage can run several at once).
