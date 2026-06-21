## Context

`/bracket` (`app/[locale]/(public)/bracket/page.tsx`) is a dynamic server component: it calls `getBracket()` (which reads `matches` via `createServerSupabaseClient`, cookie-bound → dynamic) and `buildBracket()` (pure resolver: Winner/2nd from standings, best-third allocation incl. the new provisional projection, Winner/Loser-Match from recorded knockout results). So a fresh request always reflects current results — but there is no push, so an open page goes stale until reload.

The live leaderboard set the pattern: `public.scores` is in the `supabase_realtime` publication and `components/leaderboard-live.tsx` subscribes + re-fetches. The bracket reads `public.matches`, which is **not** in the publication. `matches_select_public` (init migration) makes matches anon-readable, so Realtime will deliver matches changes to anon and authed clients alike.

## Goals / Non-Goals

**Goals:**
- The bracket updates without a manual reload when a match finalizes (or any match row changes).
- Keep the server render as the single source of truth (allocation, provisional thirds, match-number resolution).
- Graceful when Realtime is off.

**Non-Goals:**
- Re-deriving the bracket on the client (the allocation table + match-number logic live server-side; duplicating them client-side is needless).
- Per-cell streaming or animations.
- Live updates for other pages (could reuse the same publication later for /standings — out of scope here).

## Decisions

### Decision: `router.refresh()` on matches change (not client re-fetch)
A `"use client"` component subscribes to `postgres_changes` on `public.matches` (event `*`), debounces ~750ms, and calls `router.refresh()` (Next.js soft refresh) — which re-runs the dynamic server component and recomputes the whole bracket. Unlike the leaderboard (which re-fetches a single view), the bracket's value comes from server-side `buildBracket` (allocation + numbering); `router.refresh()` reuses it exactly, so there is no client/server divergence.

*Alternative considered:* an API route returning the computed bracket + client swap — rejected; more surface for the same result, and `router.refresh()` already gives a correct, atomic recompute.

### Decision: Add `public.matches` to the Realtime publication
A new idempotent migration adds `public.matches` to `supabase_realtime` (guarded by `pg_publication_tables`, like the scores migration). No RLS change — `matches_select_public` already governs delivery. Must be applied to prod (the publication is DB state, not code).

### Decision: Subscribe to all matches changes, debounced
Filtering Realtime to `status=eq.final` is brittle (depends on the change payload). Subscribe to any `matches` change and debounce; the cost is an occasional extra refresh during live score updates, which is fine and even desirable (live scores show too). The debounce coalesces the burst when a sync writes several rows.

## Risks / Trade-offs

- **[Refresh storms during a sync writing many rows]** → debounce coalesces them into one `router.refresh()`.
- **[Realtime not enabled / connection fails]** → component silently no-ops; the page still updates on reload/navigation (already dynamic). No regression.
- **[Publication migration not applied to prod]** → live updates simply don't fire until applied; on-load resolution is unaffected. Called out as an ops step.

## Migration Plan

Migration (add matches to publication) + one client component + mounting it on the page. No schema table change, no new env. Apply the publication migration to prod and redeploy. Rollback = drop matches from the publication and remove the component.
