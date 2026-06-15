## Why

Every data-heavy route in the app is a single async server component that renders nothing until its Supabase queries resolve — so on navigation the user sees a blank gap below the nav until data arrives. There are **zero** `loading.tsx` files and no skeleton primitive today. Skeleton screens give instant perceived feedback, communicate the shape of the incoming content, and remove the jarring blank-then-pop transition on the highest-traffic pages (leaderboard, matches, groups, my-picks, quiz, news).

## What Changes

- Add a base `Skeleton` primitive (`components/ui/skeleton.tsx`) — a `motion-safe:animate-pulse` muted block that respects reduced motion and is `aria-hidden`.
- Add a small set of **layout-mirroring** composed skeletons under `components/skeletons/` (page shell, table, list rows, card grid, scoreboard, stat cards, text lines) so each route fallback is a thin composition that cannot drift from real markup and produces ~zero layout shift.
- Add route-level `loading.tsx` fallbacks for high- and medium-priority routes using the Next.js App Router `loading.tsx` convention, which auto-wraps each page in a Suspense boundary **below** the already-streamed `[locale]` nav/footer shell.
- Each fallback is locale- and param-agnostic (loading.tsx receives no `params` and must not call `getTranslations`), exposes a single `role="status"` / `aria-busy` region with an sr-only label, and matches the real page's wrapper geometry and known row counts.
- **Out of scope**: static marketing pages (landing, how-it-works), onboarding, pure admin forms, all `layout.tsx` auth gates, and existing client-side incremental loading (news infinite scroll, kickoff countdown, answer submit).

## Capabilities

### New Capabilities
- `skeleton-loading`: route-level skeleton fallbacks and a shared skeleton component system that give instant, layout-stable, accessible loading feedback on data-heavy routes.

### Modified Capabilities
<!-- none -->

## Impact

- New: `components/ui/skeleton.tsx`; `components/skeletons/*` (page-skeleton-shell, text-lines, table, list-rows, card-grid, scoreboard, stat-cards).
- New `loading.tsx` files (~14) co-located with high/medium-priority `page.tsx` route segments across `(public)`, `(app)`, and `(admin)` groups.
- No changes to existing pages, data fetching, SQL, or APIs. No new dependencies (Tailwind v4 `animate-pulse` + `cn()` already present; `globals.css` already honors `prefers-reduced-motion`).
- No breaking changes.
