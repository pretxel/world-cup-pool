## Why

The admin `/admin/matches` workspace stacks four unrelated sections in one long scroll — result sync, knockout round reveal, the new-fixture form, and the full fixtures list. As the schedule grows the page gets long and the operational controls (sync, confirm, reveal) get pushed above a list the admin scrolls past constantly. Grouping the sections into tabs gives the admin a single, scannable workspace where each concern is one click away instead of a scroll away.

## What Changes

- Reorganize the admin matches page into **three tabs**:
  - **Fixtures** — the new-fixture form plus the full fixtures list (the default tab).
  - **Sync** — the result-sync panel and the "confirm knockout teams" action, with their result/status panels.
  - **Reveal** — the knockout round reveal toggles. This tab only appears when the managed competition has knockout rounds (matching today's conditional render).
- The active tab is **URL-owned** (`?tab=fixtures|sync|reveal`) so the view is linkable, survives reload, and — critically — server actions that redirect back to the page (sync, confirm, fixture delete) land the admin on the tab that shows their result instead of resetting to the default.
- Each section's behavior, forms, actions, and result panels are **unchanged**; only their grouping and navigation change. The page header and live region stay above the tabs.
- The default/fallback tab is **Fixtures**; an unknown or absent `?tab` value falls back to it, and `?tab=reveal` with no knockout rounds falls back too.

## Capabilities

### New Capabilities

- `admin-matches-tabs`: a tabbed layout for the admin matches workspace that groups the existing sections into Fixtures / Sync / Reveal tabs, with URL-owned tab selection that is set correctly after action redirects and degrades gracefully when the Reveal tab is not applicable.

### Modified Capabilities

_None._ `admin-fixture-editing`, `admin-operations-monitoring`, and `knockout-round-reveal` keep their requirements; this change only re-presents the same controls inside tabs and does not alter what any action does.

## Impact

- **Code (new)**
  - `components/admin/admin-matches-tabs.tsx` — client tabs shell wrapping shadcn `Tabs`, writing `?tab=` via `useQueryParamWriter`; receives each section as `children`/slots so the page stays a Server Component for data fetching.
- **Code (modified)**
  - `app/[locale]/(admin)/admin/matches/page.tsx` — parse/validate the `tab` param (with redirect-aware defaulting), wrap the four existing section blocks in the three tab slots, keep header + `LiveRegion` outside the tabs.
  - `app/[locale]/(admin)/admin/matches/actions.ts` — sync / confirm redirects target `?tab=sync`; the detail delete redirect targets `?tab=fixtures` (preserving existing result params).
- **i18n**: three tab labels (Fixtures / Sync / Reveal) across en/es/fr (+ de if present); no other copy changes.
- **No impact** on data, schema, scoring, the per-match detail page, or the public matches list.
