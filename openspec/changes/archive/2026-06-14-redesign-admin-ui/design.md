## Context

The admin section (`app/[locale]/(admin)/admin/*` + `components/admin/*`) is feature-complete and well-architected: Server Components, Server Actions, three-layer auth, full en/es/fr i18n, Tailwind v4 + shadcn/Base UI primitives. What it lacks is design execution — flat lists, bare native form controls, weak hierarchy, inconsistent feedback. The public app already defines a strong stadium aesthetic via theme tokens in `app/globals.css` (Bricolage/Manrope/JetBrains fonts; pitch-green primary; gold accent; oklch light "cream"/dark "floodlit ink" surfaces). This redesign carries that aesthetic into admin as an "operator control room" and restructures interactions for faster operation — without changing any behavior.

Constraints:
- Next.js in this repo has breaking changes vs. common training data — consult `node_modules/next/dist/docs/` before writing route/component code.
- Server Actions, route structure, auth gating, RLS, email, and external providers are out of bounds.
- React 19 + Next 16: use modern pending-state hooks rather than manual `useState` plumbing.
- Stakeholder: the pool owner is the primary (likely sole) admin; optimize for confident, error-resistant solo operation.

## Goals / Non-Goals

**Goals:**
- One cohesive admin design language reusing existing theme tokens and `components/ui/*`.
- Restructure each screen's layout/interaction for scannability and speed (command bar, status-forward dashboard, competition status cards + sectioned form, fixtures table with inline result entry, guided quiz form).
- Consistent operational states everywhere: empty, pending, success/error.
- Mobile-first, accessible (focus, keyboard, labels, dialog focus management), light/dark safe.
- Keep all copy localized; add new keys to all three locale files.

**Non-Goals:**
- No change to Server Actions, data model, RLS, auth, email, or result providers.
- No new heavy dependencies or a separate admin design system/library.
- No route/URL changes.
- Not redesigning the public app or `components/ui/*` primitives (small additive primitives only if a real gap exists).

## Decisions

### D1: Extend existing theme tokens; do not fork a new palette
Reuse `app/globals.css` variables; express the "control room" feel through layout density, surface layering, and accent usage — not new colors. If admin needs differentiation, add a few admin-scoped utility classes/tokens layered on the existing scale.
- **Why**: Cohesion with the product; zero risk of light/dark regressions; aligns with the `brand-identity` capability already governing theme.
- **Alternative considered**: A bespoke admin theme — rejected as off-brand, double-maintenance, and contrary to the "same product" goal.

### D2: Introduce a small set of shared admin presentation components
Add focused, composable components (e.g. `AdminPageHeader`, `StatusCard`, `FormSection`, `FixturesTable`, `EmptyState`, and a feedback/`ActionStatus` helper) under `components/admin/`, built from `components/ui/*`. Screens compose these instead of repeating ad-hoc markup.
- **Why**: Removes duplication across four screens, enforces consistency, keeps each route file declarative.
- **Alternative considered**: Restyle inline per screen — rejected; drifts and duplicates state/empty/feedback patterns.

### D3: Keep Server Components as the default; add Client Components only for interaction
Pages stay server-rendered (data fetch + i18n on the server). Pending state, inline editing toggles, and the managed-context switcher are isolated Client Components. Server Actions remain the mutation path; pending/feedback is read from action lifecycle, not refactored into client fetches.
- **Why**: Preserves the current architecture and auth posture; minimal client JS.
- **Alternative considered**: Convert screens to client-fetched data — rejected; needless churn and regression surface.

### D4: Use React 19 / Next 16 action-state hooks for pending + feedback
Wrap submit controls so they reflect pending state (e.g. `useFormStatus` for submit buttons; `useActionState` where a result/message must render). The existing confirm-gated buttons (resend, set-active) adopt the same pending+result pattern.
- **Why**: Satisfies the "consistent operational states" requirement with idiomatic, minimal code; no global state library.
- **Alternative considered**: Manual `useState`/`useTransition` everywhere — more boilerplate, easy to do inconsistently.
- **Note**: Verify exact hook APIs against `node_modules/next/dist/docs/` and installed React before coding.

### D5: Fixtures as a responsive table, not cards
Desktop: a dense table (kickoff, teams, status badge, inline score inputs, grouped actions). Narrow viewports: collapse rows to stacked cards. Result entry stays inline; delete is visually separated from the primary result action.
- **Why**: Operators scan many fixtures; a table maximizes density and comparison while inline entry minimizes clicks.
- **Alternative considered**: Keep per-fixture collapsibles — rejected as slow to scan and low-density.
- **Risk note**: a true `<table>` must degrade gracefully on mobile (see Risks).

### D6: Feedback is inline and scoped, with restrained motion
Show success/error/summary near the action that produced it (the redesign keeps the existing inline-summary approach, just consistent and styled). Motion is limited to high-impact moments: one staggered page-load reveal per screen and smooth state transitions; respect `prefers-reduced-motion`.
- **Why**: Inline feedback ties outcome to cause and avoids introducing a toast/portal system. Restraint fits a utility surface and avoids "AI slop" motion.
- **Alternative considered**: A global toast system — deferred; only add a shared primitive if multiple screens clearly need ephemeral notifications.

### D7: i18n-first copy
Every new string lands as keys in `messages/en.json`, `es.json`, `fr.json`, rendered via `getTranslations`/`useTranslations`. Reuse existing `admin`, `quiz`, `matchStatus` namespaces; add subkeys for new empty/section/helper copy. No hard-coded literals.
- **Why**: Matches the localized-copy requirement and existing patterns; keeps the three locales in sync.

## Risks / Trade-offs

- **Accessible responsive table** → On mobile, restructure rows to stacked cards (or `display`-driven layout) while preserving header associations; verify with keyboard + screen-reader names for icon actions.
- **Pending/action-state hook API drift** (Next 16 / React 19 differ from training data) → Confirm `useFormStatus`/`useActionState` usage against in-repo docs before implementing; build one screen first as the reference pattern.
- **Translation gaps** (es/fr lag en) → Land all three keys in the same change; a lint/grep check for missing keys before completion.
- **Scope creep into behavior** → Hard line: no edits to `*/actions.ts` logic, auth, or data. PR diff should be presentation/markup + new presentational components + locale keys only.
- **Motion overdone** → Cap to one orchestrated load reveal per screen + state transitions; gate on `prefers-reduced-motion`.
- **Component churn vs. consistency** → Land shared admin components first, then refactor screens onto them, to avoid half-migrated drift.

## Migration Plan

1. Add/confirm any admin-scoped theme tokens/utilities in `app/globals.css`.
2. Build shared admin presentation components (`AdminPageHeader`, `StatusCard`, `FormSection`, `EmptyState`, `ActionStatus`/pending wrapper) with the action-state pattern as the reference.
3. Redesign the shell + managed-context bar (command bar, divergence warning, context switch).
4. Migrate screens in order: Dashboard → Competitions (list + form) → Fixtures (table) → Quiz, each adopting the shared components and adding locale keys as it goes.
5. Accessibility + responsive pass (keyboard, focus, mobile layouts, reduced motion); verify light/dark.
6. i18n completeness check across en/es/fr.
- **Rollback**: Pure presentation change with no data/route/action edits — revert the PR to restore prior UI; no migrations or data risk.

## Open Questions

- Should an ephemeral toast primitive be added now, or is scoped inline feedback sufficient for all four screens? (Default: inline; add toast only if a screen clearly needs it.)
- Does the fixtures volume warrant filtering/sorting/pagination in this pass, or is a dense static table enough for current competition sizes? (Default: dense static table; defer filtering unless counts are large.)
- Any admin actions worth surfacing on the dashboard as one-click shortcuts (e.g. "Sync results now") vs. keeping them on their screens? (Default: keep on their screens; dashboard links only.)
