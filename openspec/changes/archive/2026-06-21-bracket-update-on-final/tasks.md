## 1. Realtime publication

- [x] 1.1 Add a migration (timestamped after the latest) adding `public.matches` to the `supabase_realtime` publication, guarded by `pg_publication_tables` (idempotent), mirroring `20260619160000_scores_realtime_publication.sql`. No RLS change (`matches_select_public` already allows delivery).

## 2. Live-refresh component

- [x] 2.1 Add `components/bracket-live-refresh.tsx` (`"use client"`): on mount, subscribe via `createBrowserSupabaseClient()` to `postgres_changes` on `public.matches` (event `*`), debounce (~750ms), and call `router.refresh()` (next/navigation). Remove the channel + clear the timer on unmount; silently no-op on any subscribe error. Renders nothing.

## 3. Page integration

- [x] 3.1 Mount `<BracketLiveRefresh />` in `app/[locale]/(public)/bracket/page.tsx` (the page stays dynamic/compute-on-read; the component just triggers refreshes).

## 4. Verification

- [x] 4.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; fix failures.
- [ ] 4.2 Manually verify (after applying the publication migration): with `/bracket` open, finalizing a knockout match (or any match change) refreshes the bracket without a reload; with Realtime off it still renders and updates on reload.
