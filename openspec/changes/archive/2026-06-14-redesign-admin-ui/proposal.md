## Why

The admin section is fully functional but visually unfinished: plain bordered `<li>` lists, bare `<select>`/`<input>` rows, no visual hierarchy, and inconsistent feedback states. It does not carry the product's stadium/pitch aesthetic (Bricolage headings, pitch-green + gold, oklch floodlit theme) that the public-facing app uses, so the admin "control room" feels like a different, lower-quality product. As the pool owner spends real operational time here (running competitions, entering results, scheduling quizzes), the area deserves a cohesive, confident, fast-to-operate interface.

## What Changes

- Introduce a cohesive **admin design language** — an "operator control room" treatment of the existing stadium theme — applied across every admin screen.
- **Admin shell**: redesign the sticky header/nav and the managed-context bar into a clear command bar with active/managed competition state, prominent enough to prevent editing the wrong competition.
- **Dashboard**: replace the three plain tiles with a status-forward landing — live vs. managed competition at a glance, quick stats, and primary actions.
- **Competitions**: turn the flat list into scannable status cards with grouped actions; restructure the create/edit form into clear sections (identity, dates, format, providers, branding) with better empty/disabled states (e.g. slug-locked).
- **Fixtures/Matches**: restructure the long collapsible list into a denser, sortable fixtures table with inline result entry and clearer status badges (unconfirmed, overdue, final); group destructive/secondary actions.
- **Quiz**: restructure the question + translations form into a guided layout (prompt, options with correct-answer selection, schedule, optional es/fr translations) with clearer validation and resend feedback.
- **Shared UX**: consistent empty states, loading/pending states on server-action buttons, success/error feedback, responsive (mobile-first) layouts, accessible focus/keyboard handling, and restrained, high-impact motion (staggered load, state transitions).
- No change to routes, server actions, data flows, auth gating, or i18n keys' meaning — strings stay translated (en/es/fr); only presentation and interaction patterns change. New copy (empty states, labels) adds keys to all three locale files.

## Capabilities

### New Capabilities
- `admin-ui`: The redesigned admin experience — shell/navigation, managed-context command bar, dashboard, and the cross-cutting visual + interaction design language applied to all admin screens (competitions, fixtures, quiz), including responsive layout, empty/loading/feedback states, accessibility, and motion. Owns *how* admin is presented and operated; the behavioral specs (`admin-competitions`, `admin-fixture-editing`, `daily-quiz`) continue to own *what* the screens do.

### Modified Capabilities
<!-- None — underlying behavior (data, actions, validation, auth) is unchanged. Only presentation and interaction patterns change, which the new admin-ui capability now governs. -->

## Impact

- **Components**: `components/admin/*` (admin-shell, managed-context-bar, competition-form, set-active-dialog, resend buttons) restyled/restructured; likely new shared admin presentation components (e.g. status card, page header, fixtures table, form section, empty state).
- **Routes (presentation only)**: `app/[locale]/(admin)/admin/{page,competitions,matches,quiz}` markup/layout; server actions in their `actions.ts` files unchanged.
- **UI primitives**: reuses `components/ui/*` (Button, Card, Input, Label, Badge, Dialog); may add small primitives if a gap appears (e.g. Table, Toast/feedback, Select).
- **Styling**: Tailwind v4 + existing theme tokens in `app/globals.css`; may add admin-scoped tokens/utilities. No new heavy dependencies.
- **i18n**: `messages/{en,es,fr}.json` — add keys for new copy (empty states, section labels, helper text); no removal of existing keys.
- **Accessibility/responsive**: mobile-first layouts, keyboard/focus states, color-contrast within theme.
- **No impact**: database, RLS, auth model, email sending, external result providers.
