## Context

`BracketView` (`components/bracket-view.tsx`, server component) renders the knockout bracket as a horizontally-scrolling row of fixed-width columns:

```
<div className="overflow-x-auto"><div className="flex min-w-max gap-3 sm:gap-4">
  {main.map(round => <div className="w-52 flex-col justify-around">…MatchCards…</div>)}
</div></div>
```

plus a separate third-place block below. `main = rounds.filter(stage !== 'third')`. The page (`/bracket`) fetches `{ rounds, matches }` server-side and passes localized `labels` (`stage` map, `provisional`, `thirdPlace`). `MatchCard`/`ParticipantRow` are pure render helpers in the same file (they use `LocalTime` + `TeamFlag`).

Live check (390px): the R32 column ≈ the full viewport width, later headers clip off-screen, and `justify-around` scatters later-round cards down the column — two-axis scrolling, unreadable. Desktop (≥ ~1100px) is acceptable.

The repo already ships `components/ui/tabs.tsx` (Base UI tabs), used by the admin tabs and the competition form.

## Goals / Non-Goals

**Goals:**
- A mobile bracket with **no horizontal content scroll and no clipping**: one round visible at a time, its matches stacked full-width.
- Identical card content/behavior across both layouts (single source of truth for `MatchCard`).
- Keep the page server-rendered; minimal client surface.

**Non-Goals:**
- No change to the desktop columnar layout (explicitly out of scope per the request — `lg+` is untouched).
- No change to bracket resolution, data fetching, or labels.
- No bracket connector lines / SVG redraw.

## Decisions

### D1: CSS-toggled dual layout at the `lg` breakpoint
Render **both** layouts and toggle by viewport: existing columns wrapped in `hidden lg:block`; the new round selector in `lg:hidden`. The columnar bracket needs ~1100px to show all rounds without scroll, so `lg` (1024px) is the natural cutover — phones and small tablets get the selector, true desktop keeps columns.
- *Alternative:* a JS/media-query switch rendering only one tree. Rejected — CSS toggle is simpler, SSR-safe (no hydration flash), and the duplicated DOM is tiny (~31 cards).

### D2: Reuse `MatchCard`; the mobile selector is the only client island
Export `MatchCard` (and the `Labels` type) from `bracket-view.tsx`. A new `components/bracket-rounds-mobile.tsx` (`"use client"`) owns the active-round `useState` and renders the selected round's `MatchCard`s in a vertical stack. `MatchCard`/`ParticipantRow` stay plain functions (no client boundary needed) usable from both the server columns and the client selector.
- *Why client:* the round selector needs interactive state. The rest of the page stays server-rendered.

### D3: Round selector = scrollable Base UI `Tabs` with full localized labels
Use the existing `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`. The `TabsList` is allowed to **scroll horizontally** (`overflow-x-auto`, no wrap) so full localized round names ("Round of 16", "Quarter-final", …) fit without truncation; only the thin tab strip scrolls, never the match content. One `TabsContent` per round holds that round's stacked cards.
- *Alternative:* short codes (R16/QF/SF) to avoid scroll. Rejected — would need new per-locale short strings; a scrollable strip is a standard, fully-localized mobile pattern.
- Tabs order follows the `rounds` array (engine order: R32 → R16 → QF → SF → Third → Final); third place is one of the tabs rather than a separate block on mobile.

### D4: Default round + a11y
Default the active tab to the **first round** (Round of 32) for determinism. Base UI provides tablist semantics, roving focus, and visible focus. Each match card keeps its existing structure; the selector adds a labelled `tablist` (aria-label from i18n).
- *Possible later enhancement:* default to the earliest round still containing a non-final match (the "live" round). Noted, not required.

## Risks / Trade-offs

- **[Duplicate DOM / live refresh]** both layouts mount, so cards exist twice → Mitigation: trivial node count; `BracketLiveRefresh` triggers a server re-render of the whole page, refreshing both trees identically.
- **[`MatchCard` shared across server/client]** → Mitigation: it's a pure function using `LocalTime`/`TeamFlag` (both already client-capable); importing it into a `"use client"` module is fine.
- **[Tab strip overflow]** many rounds on a narrow strip → Mitigation: the strip itself scrolls horizontally (intended), with full labels; verify at 390px that the active tab is reachable.
- **[Empty/early bracket]** rounds with only placeholders → unchanged: the selector still lists every present round and shows placeholder cards, matching today's content.

## Migration Plan

Pure presentation refactor of one component (+ one small client child). Ship `bracket-view.tsx` + `bracket-rounds-mobile.tsx`; `/bracket` picks it up. Rollback = revert the component. No data/config/migration.

## Open Questions

- Cutover breakpoint `lg` vs `xl` — `lg` chosen (columns need ~1100px). Tunable in one className if tablets should keep columns.
- Whether to default the selector to the current/live round later (D4) — deferred.
