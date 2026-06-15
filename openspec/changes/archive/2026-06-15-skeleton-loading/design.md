## Context

The app is Next.js 16.2.6 (App Router, breaking changes vs. common training data). Every target route is a single async server component whose `page.tsx` awaits Supabase queries (and `params`/`getTranslations`); nothing meaningful renders until those resolve. There are no `loading.tsx` files and no `Skeleton` primitive. The `[locale]` layout awaits `params`, calls `setRequestLocale`, and renders `SiteNav`/`SiteFooter` **before** children, so the static shell can stream immediately. The `(app)` and `(admin)` layouts are async auth / `is_admin` gates. Tailwind v4 (`animate-pulse` available), a `cn()` helper, and a `prefers-reduced-motion` block in `globals.css` are already in place. The universal page wrapper is `<main className="mx-auto max-w-4xl px-4 py-10">` with a consistent eyebrow / headline / lede header.

## Goals / Non-Goals

**Goals:**
- Instant, layout-stable loading feedback on data-heavy routes via skeletons that mirror the resolved layout (≈zero CLS).
- A single shared skeleton component system so route fallbacks are thin compositions that cannot drift from real markup.
- Correct accessibility (one `role="status"`/`aria-busy` region per fallback, `aria-hidden` bars, sr-only label) and reduced-motion behavior.

**Non-Goals:**
- Skeletons for static marketing pages (landing, how-it-works), onboarding, or pure admin forms.
- Layout-level skeletons or changing the `(app)`/`(admin)` auth gates.
- Replacing existing client-side incremental loading (news infinite scroll, countdown, answer submit) or error/empty states.
- Enabling Cache Components.

## Decisions

**Decision: Use the `loading.tsx` route convention as the primary mechanism; reserve in-page `<Suspense>` for genuinely independent sub-streams only.**

Per the Next 16.2.6 docs (`loading.md`, `streaming.md`), `loading.js` automatically wraps `page.js` (and below) in a Suspense boundary **without** wrapping the layout, showing the fallback instantly on navigation. Because every target route is a single fetch-cluster async component beneath the already-streamed `[locale]` shell, a route-level fallback is the canonical fit and gives a complete-looking page (nav + footer + skeleton) immediately. Alternatives considered: blanket in-page `<Suspense>` everywhere — rejected, it forces duplicating each page's data decomposition and wrapper markup with no UX gain over `loading.tsx` for single-cluster pages. Suspense is kept only for cases like the matches filter components (which already use null fallbacks — left untouched).

**Decision: Build shared, layout-mirroring primitives first; loading.tsx files are thin compositions.**

A base `<Skeleton>` (`components/ui/skeleton.tsx`) plus composed skeletons in `components/skeletons/`: `PageSkeletonShell` (universal `mx-auto max-w-4xl px-4 py-10` wrapper + header rhythm + the `role="status"` region), `TableSkeleton` (cloned from `LeaderboardTable`, incl. `hidden sm:table-cell` columns), `ListRowsSkeleton`, `CardGridSkeleton`, `ScoreboardSkeleton` (pitch card, `match-vs` / `single-stat` variants), `StatCardsSkeleton`, `TextLinesSkeleton`. Centralizing geometry is the primary mitigation against layout drift: when a page wrapper changes, the shared primitive changes once.

**Decision: Fallbacks are textless, locale- and param-agnostic.**

`loading.tsx` receives no `params`/`searchParams` and must not call `getTranslations`/`setRequestLocale` (the `[locale]` layout already set locale before children render). Skeletons contain no translated copy; the only text is an sr-only literal ("Loading") inside the status region. Dynamic-route skeletons (`[matchId]`, `[id]`, `[code]`, `[userId]`) are designed param-agnostic (generic scoreboard / group header).

**Decision: Match known fixed row/card counts to prevent height jumps.**

Leaderboard and quiz boards = 10 rows; my-picks list = 5 (PAGE_SIZE); groups/[id] board = 4. Variable lists (matches days, admin tables) use a representative count (2–3 day sections, 6–8 rows) since they have no fixed expected height.

**Decision: Ship by priority.** High: leaderboard, matches, matches/[matchId], quiz, groups, groups/[id], my-picks. Medium: news, three share pages, groups/join/[code], admin dashboard, admin/competitions. Low/optional: admin/matches, admin/quiz.

## Risks / Trade-offs

- **Layout shift (CLS) if skeleton geometry mismatches the resolved page** → Reuse exact wrapper/column classes in the shared primitives; fixed heights for badges/inputs/flags/number blocks; verify before/after at mobile/sm/lg.
- **Flash of skeleton on fast (warm) loads** → Fallback only shows if the boundary actually suspends; calm `animate-pulse`, no artificial delay; reduced-motion users get a static block (no flash-pulse). Accept rare flash on usually-fast routes (share, groups/join).
- **Markup drift between loading.tsx and page.tsx over time** → All shared geometry lives in `components/skeletons/*`; co-locate `loading.tsx` next to `page.tsx` so reviewers see both in one diff.
- **next-intl misuse in loading.tsx** → No `getTranslations`/`setRequestLocale`/`params` in any `loading.tsx`; textless skeletons with an sr-only label only.
- **Accessibility noise from many placeholder divs** → One `role="status"`/`aria-busy` region with sr-only label per fallback (provided by `PageSkeletonShell`); base `Skeleton` is `aria-hidden`.
- **Reduced-motion distraction** → Gate pulse behind `motion-safe:animate-pulse`, consistent with existing `globals.css` reduced-motion conventions.
- **(app)/(admin) fallback appears only after the auth gate resolves** → Correct Next behavior; the skeleton still covers the heavier page-level queries. Public routes (no gate) are the highest-impact targets where shell + skeleton appear instantly.
- **Cache Components follow-up** → Not enabled here; if adopted later, the auth reads in `(app)`/`(admin)` layouts will need explicit Suspense wrapping. Out of scope, noted as follow-up.
