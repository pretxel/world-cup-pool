## Why

The `/bracket` page is computed on read, so it already reflects a finished knockout match (winner advancing, third-place projection) — but only after a manual reload. During a knockout matchday a viewer watching the bracket sees nothing change when a match goes final until they refresh. The leaderboard already updates live (Realtime); the bracket should too.

## What Changes

- Make `/bracket` **update live** when match data changes: a small client component subscribes to Realtime changes on `public.matches` and triggers a (debounced) refresh of the server-rendered bracket, so a finished match's advancement / third-place reshuffle appears without a manual reload.
- Add `public.matches` to the `supabase_realtime` publication (idempotent), mirroring how `public.scores` was added for the live leaderboard.
- Refresh re-runs the existing server render (`getBracket` → `buildBracket`), so the official allocation, provisional projections, and Winner/Loser-Match resolution stay the single source of truth — the client never re-derives the bracket.
- Graceful: if Realtime is unavailable, the page still updates on normal reload/navigation (it is already dynamic). No-op when nothing is listening.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `playoff-bracket`: the bracket page gains live updates — it refreshes its server-rendered bracket when `public.matches` changes (e.g. a knockout match finalizes), in addition to the existing on-load resolution.

## Impact

- **New migration**: add `public.matches` to the `supabase_realtime` publication (guarded; `matches_select_public` RLS already allows anon/auth delivery). Needs applying to prod (like the scores publication).
- **New client component**: `components/bracket-live-refresh.tsx` — subscribes to `public.matches` `postgres_changes`, debounces, calls `router.refresh()`; silently no-ops if Realtime never connects.
- **Page**: `app/[locale]/(public)/bracket/page.tsx` mounts the live-refresh component (the page is already dynamic/compute-on-read).
- **No new dependency, no schema table change.** Reuses `@/lib/supabase/browser` + the existing bracket render. Pattern mirrors `components/leaderboard-live.tsx`.
