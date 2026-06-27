## Context

`app/[locale]/(admin)/admin/matches/page.tsx` is an async Server Component that fetches the managed competition + its matches, then renders four stacked sections inside one `admin-reveal space-y-8` column: result sync (`Card`), knockout round reveal (`Card`, conditional on `knockoutStages.length > 0`), the new-fixture form (`Card` + `FormSection`), and the fixtures list (`section`). A persistent `<LiveRegion>` and `<AdminPageHeader>` sit at the top.

Several server actions in `actions.ts` (`syncNow`, `confirmKnockoutTeams`, `toggleKnockoutRoundReveal`) and the detail page's delete redirect back to this page with result query params (`syncSource`/`syncMatched`/…, `confirmUpdated`, `deleteResult=deleted`); the page reads those params and renders inline `ActionStatus` panels. Any tab solution must keep those result panels visible after the redirect.

The repo already ships a shadcn `Tabs` (`components/ui/tabs.tsx`, built on `@base-ui/react`) and a `useQueryParamWriter` hook used by the public matches filters to own ephemeral view state in the URL.

## Goals / Non-Goals

**Goals:**
- Group the four sections into three tabs — **Fixtures** (new-fixture form + list), **Sync** (result sync + confirm knockout), **Reveal** (knockout round reveal) — with Fixtures as the default.
- Keep the page a Server Component (data fetching unchanged); introduce a thin client wrapper only for the interactive tab strip.
- Make tab selection URL-owned (`?tab=`) so it is linkable, reload-safe, and correct after action redirects.
- Preserve every section's existing behavior, markup, actions, and result panels verbatim.

**Non-Goals:**
- No change to what any action does, to the per-match detail page, or to the public `/matches` list.
- No new data fetching, schema, or scoring change.
- No nested/sub-tabs and no per-tab lazy data loading (all data is already fetched once for the page).

## Decisions

### 1. URL-owned tab state (`?tab=fixtures|sync|reveal`), not client-only

The tab is parsed server-side from `searchParams` and passed to a controlled `Tabs`. Rationale: server actions redirect back here, and an uncontrolled/client-default tab would snap back to Fixtures on every redirect — hiding the sync/confirm result the admin just triggered. URL ownership also makes tabs linkable and reload-safe, matching the established `?round=`/`?team=` pattern on the public list.

- **Alternative considered:** uncontrolled `Tabs` with `defaultValue` + `useState`. Rejected: loses state across the action round-trip (the whole point of the Sync tab is to show the result).
- **Alternative considered:** parse the tab purely client-side from `window.location`. Rejected: the page already reads `searchParams` server-side for result params; reading tab there too keeps one source of truth and avoids a flash of the wrong tab.

### 2. Server page renders sections; a client wrapper renders the tab chrome

The page stays async/server and renders the four section blocks as before, but passes them as named slots (props typed `React.ReactNode`) into a new client component `components/admin/admin-matches-tabs.tsx`. That component wraps shadcn `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, receives `value` (server-parsed) + the slot nodes, and writes `?tab=` via `useQueryParamWriter` on change. Passing server-rendered JSX as children to a client component is supported and keeps all Supabase/i18n work on the server.

- **Alternative considered:** convert the whole page to a client component. Rejected: would move data fetching to the client and lose `setRequestLocale`/server translations.

### 3. Redirect-aware default + graceful fallback

The active tab is resolved as: explicit valid `?tab` → use it; else infer from present result params (`syncSource` or `confirmUpdated` ⇒ `sync`); else `fixtures`. Additionally, `tab=reveal` is downgraded to `fixtures` when the managed competition has no knockout rounds. The action redirects are also updated to append the right tab (`syncNow`/`confirmKnockoutTeams` ⇒ `tab=sync`; detail delete ⇒ `tab=fixtures`) so the URL is canonical, with the param-inference above as a safety net for bookmarks.

### 4. Reveal tab is conditional

The Reveal trigger and panel render only when `knockoutStages.length > 0`, mirroring today's conditional `Card`. When absent, the tab strip shows two tabs and `?tab=reveal` falls back to Fixtures (see Decision 3).

### 5. Header + LiveRegion stay outside the tabs

`<AdminPageHeader>` and the always-mounted `<LiveRegion>` remain above the `Tabs` so screen-reader announcements (sync/delete outcomes) fire regardless of the active tab, and the page identity is constant across tabs. The top-level `fixtureDeleted` `ActionStatus` banner also stays above the tabs (it is a page-level confirmation, not section content).

## Risks / Trade-offs

- **Action redirect lands on wrong tab / result hidden** → URL-owned tab (Decision 1) plus action redirects that set `tab=` (Decision 3) plus param inference as a fallback.
- **Controlled base-ui `Tabs` value/trigger mismatch throws or shows blank** → tab keys are a small fixed union (`"fixtures" | "sync" | "reveal"`); validate/normalize the param to that union before passing it as `value`, defaulting to `fixtures`.
- **Mobile width: three triggers crowd small screens** → labels are short; make `TabsList` full-width (`grid grid-cols-2/3`) on `<sm` so triggers stay tappable; verify ≥44px targets.
- **Tab change does a full navigation / scroll jump** → `useQueryParamWriter` uses `router.replace` without scroll reset (same as existing filters); confirm the tab swap doesn't jump the viewport.
- **Reveal tab disappearing changes layout when toggling competitions** → acceptable; it matches the existing conditional render and the param falls back safely.
