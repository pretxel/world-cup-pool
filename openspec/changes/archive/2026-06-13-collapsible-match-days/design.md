## Context

`/matches` (`app/[locale]/(public)/matches/page.tsx`) is a server component. It
loads confirmed matches, applies URL-driven filters (team / status / picks),
then groups the survivors into a `Map<utcDateKey, MatchRow[]>` and renders one
`<section>` per day. Each section has a sticky `<h2>` header (matchday label,
localized date via the client `LocalTime`, per-day count) followed by a `<ul>`
of `MatchRowCard` rows. Rows carry a staggered CSS entrance animation
(`ROW_STAGGER_MS` / `ROW_STAGGER_CAP_MS`).

Today every day is always expanded. The codebase has no existing
accordion/disclosure primitive (`group-standings-table` only uses CSS
`border-collapse`). The closest interactivity pattern is `NeedsPickToggle`, a
small `"use client"` button — but its state lives in the URL, which is the wrong
fit here (one URL param per day would be unwieldy and would pollute shareable
links).

## Goals / Non-Goals

**Goals:**
- Let a user collapse and expand each day's match rows from its day header.
- Preserve server-side row rendering and the existing stagger animation.
- Proper disclosure a11y: header is a button, `aria-expanded`, `aria-controls`.
- Persist collapsed/expanded state across navigation and reload.
- Reasonable defaults: finished days collapsed, today/live/upcoming expanded.
- No regression to sticky-header positioning or the responsive layout.

**Non-Goals:**
- No "expand all / collapse all" master control (can be a later change).
- No server-side persistence of collapse state (no DB, no per-user storage).
- No change to filtering, sorting, data fetching, or the match row contents.
- No URL-encoded collapse state.

## Decisions

### Decision: Client shell wraps server-rendered rows via `children`

Extract a `"use client"` component `components/match-day-section.tsx`. The
server page keeps building the `<ul>`/rows exactly as today and passes the
rendered list to the client shell as `children`. The shell renders the header as
the disclosure button and conditionally shows `children`.

- **Why:** React Server Components allow a server-rendered subtree to be passed
  as `children` into a client component. This keeps `MatchRowCard`, `LocalTime`,
  `TeamFlag`, and the per-row stagger on the server/existing path — only the
  open/closed wrapper is client code. No need to port row rendering to the
  client or refetch data.
- **Alternative — make the whole section client and pass match data:** rejected.
  Would force `MatchRowCard` (and its imports) into the client bundle and
  duplicate rendering logic for no benefit.
- **Alternative — native `<details>/<summary>`:** rejected. `<details>` can't be
  driven by status-derived defaults + localStorage cleanly without hydration
  flicker, the sticky `<summary>` styling is fiddly across browsers, and we need
  the rotating-chevron + count layout the current header already has.

### Decision: State source is localStorage, keyed by day

Each section's open state is a boolean. The shell reads/writes
`localStorage["matches:day-collapsed:<utcDateKey>"]` (collapsed = `true`).

- **Why:** Per-day, survives reload and in-app navigation, no URL pollution,
  no backend. Matches the "ephemeral, client-only UI preference" nature of the
  feature.
- **Default when no stored value:** derived server-side. The page already knows
  each match's status; it computes a per-day `defaultOpen` = `false` only when
  **every** match in that day is finished (`status === 'final'`/`'cancelled'`),
  else `true`. The shell uses the stored value if present, otherwise
  `defaultOpen`.
- **Hydration:** to avoid a flash of wrong state, the server renders using
  `defaultOpen`; the client reconciles to the stored value in a `useEffect`
  after mount. Because content is CSS-hidden (not unmounted) the reconcile is a
  cheap class toggle, and rows are present in the DOM for SEO/no-JS.

### Decision: Disclosure semantics and affordance

The header becomes a `<button type="button">` (replacing the static `<h2>`
content, kept inside an `<h2>` for heading structure). It sets
`aria-expanded={open}` and `aria-controls={listId}`; the `<ul>` gets that `id`
and `hidden` when collapsed. A `ChevronDownIcon` rotates 180° via a transform
tied to `open`. The matchday label, date, and count remain in the header.

- **Why:** This is the standard accessible disclosure pattern and reuses the
  existing header layout. `hidden` (rather than unmounting) keeps the rows in the
  DOM and lets `prefers-reduced-motion`-respecting CSS handle the reveal.

### Decision: Keep stagger animation, gate on open

The stagger animation already runs on mount. When a collapsed day is later
expanded, re-running the entrance stagger is optional polish; the minimum is
that an open day shows its rows. Rows stay server-rendered with their existing
`animationDelay`; no JS re-trigger is required for correctness.

## Risks / Trade-offs

- **Hydration mismatch flash** → Server renders `defaultOpen`; client reconciles
  stored value in `useEffect` (post-paint), and content is hidden via CSS class
  rather than conditional unmount, so reconciliation can't throw a hydration
  error. Worst case is a one-frame state correction on days the user previously
  toggled against the default.
- **localStorage unavailable / disabled (private mode, SSR)** → All reads/writes
  are wrapped in try/catch; on failure the component falls back to `defaultOpen`
  and simply doesn't persist. No crash, feature degrades to per-session.
- **Sticky header regression** → The header keeps the same sticky classes and
  offsets; only its inner element changes from text to a full-width button. A
  scenario in the spec guards that sticky positioning is unchanged.
- **No-JS users** → Server renders rows present and (for non-finished days)
  visible; collapse is a progressive enhancement, so no-JS users still see the
  schedule.
- **localStorage key growth** → One key per distinct match day (~50 keys max for
  a full tournament). Negligible; no cleanup needed.

## Migration Plan

Pure additive front-end change. Deploy ships the new component + page refactor +
message strings together. Rollback = revert the commit; no data migration, no
flags. No persisted server state to clean up.

## Open Questions

- Should there be an "expand/collapse all" control? Deferred to a follow-up; not
  required for the core ask.
- Should expanding a previously-collapsed day re-trigger the row stagger? Treated
  as optional polish, not a requirement.
