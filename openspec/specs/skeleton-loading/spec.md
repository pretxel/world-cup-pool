# skeleton-loading Specification

## Purpose

Data-heavy routes render route-level skeleton fallbacks (Next.js App Router `loading.tsx`) during their initial async load, so users see structured placeholders that mirror the resolved layout instead of a blank content gap. Fallbacks are accessible, respect reduced motion, are locale- and param-agnostic, and are scoped to data-fetching routes only.

## Requirements

### Requirement: Data-heavy routes render a skeleton fallback during initial load

Each high- and medium-priority data-fetching route SHALL provide a route-level `loading.tsx` fallback (Next.js App Router loading convention) that renders immediately on navigation while the page's async server component resolves. The fallback SHALL render beneath the persistent `[locale]` nav/footer shell so the page never shows a blank content gap.

#### Scenario: Navigating to a data-heavy route
- **WHEN** a user navigates to `/leaderboard`, `/matches`, `/matches/[matchId]`, `/quiz`, `/groups`, `/groups/[id]`, or `/my-picks` and the page's data has not yet resolved
- **THEN** a skeleton fallback is shown in the content area
- **AND** the site nav and footer remain visible throughout

#### Scenario: Fallback replaced by content
- **WHEN** the page's data resolves
- **THEN** the skeleton is replaced by the real content
- **AND** no additional full-page reload occurs

### Requirement: Skeletons mirror the resolved layout to avoid layout shift

Skeleton fallbacks SHALL reuse the real page's wrapper geometry (the `mx-auto max-w-4xl px-4 py-10` shell and header rhythm) and SHALL match the resolved content's structure — table column layout (including responsive `hidden sm:table-cell` columns), card grids, scoreboard geometry, and known fixed row counts — so that swapping the skeleton for real content causes negligible cumulative layout shift.

#### Scenario: Known fixed counts
- **WHEN** the leaderboard or quiz board skeleton renders
- **THEN** it shows 10 placeholder rows
- **AND** the my-picks skeleton shows 5 rows and the group board skeleton shows 4 rows, matching their real defaults

#### Scenario: No measurable jump on resolve
- **WHEN** a skeleton fallback is replaced by resolved content at mobile, sm, and lg breakpoints
- **THEN** the header position and primary content block do not visibly jump

### Requirement: Skeleton fallbacks are accessible

Each `loading.tsx` fallback SHALL expose exactly one `role="status"` region with `aria-busy="true"` and an sr-only textual label. Individual placeholder elements (the base `Skeleton`) SHALL be `aria-hidden` so screen readers announce the loading state once rather than reading each placeholder.

#### Scenario: Screen reader announcement
- **WHEN** a skeleton fallback is shown
- **THEN** assistive technology encounters a single status region labeled as loading
- **AND** the individual placeholder bars are not announced

### Requirement: Skeletons respect reduced motion

The base `Skeleton` animation SHALL be gated behind `motion-safe` (e.g. `motion-safe:animate-pulse`). Under `prefers-reduced-motion: reduce` the skeleton SHALL render as a static muted block with no pulsing animation.

#### Scenario: Reduced-motion user
- **WHEN** a user with `prefers-reduced-motion: reduce` triggers a skeleton fallback
- **THEN** the placeholders render static with no pulse animation

### Requirement: Loading fallbacks are locale- and param-agnostic

`loading.tsx` files SHALL NOT call `getTranslations` or `setRequestLocale` and SHALL NOT read `params`/`searchParams`. Skeleton content SHALL be non-textual placeholders; the only text permitted is an sr-only loading label. Dynamic-route skeletons SHALL be designed to render correctly without knowledge of the route parameters.

#### Scenario: Dynamic route fallback
- **WHEN** the `loading.tsx` for `/matches/[matchId]`, `/groups/[id]`, `/groups/join/[code]`, or a `/share/*/[userId]` route renders
- **THEN** it renders a generic, param-agnostic skeleton
- **AND** it makes no translation or params calls

### Requirement: Scope of routes that receive skeleton fallbacks

Skeleton fallbacks SHALL be added to data-fetching routes only. Static marketing pages (`/`, `/how-it-works`), `/onboarding`, pure form routes (`/admin/competitions/new`, `/admin/competitions/[id]`), and all `layout.tsx` auth gates SHALL NOT receive a `loading.tsx`. Existing client-side incremental loading (news infinite scroll, kickoff countdown, answer submit) SHALL remain unchanged.

#### Scenario: Static page excluded
- **WHEN** a user navigates to `/` or `/how-it-works`
- **THEN** no skeleton fallback is introduced for that route

#### Scenario: Auth-gated route
- **WHEN** a user navigates to an `(app)` or `(admin)` route
- **THEN** the page-level `loading.tsx` fallback appears only after the layout's auth gate resolves
- **AND** no layout-level skeleton is added
