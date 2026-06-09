# Design — Responsive News Section

## Context

The News page (`app/[locale]/(public)/news/page.tsx`) server-renders the first page of articles inside a `max-w-4xl` container, and `NewsFeed` (`news-feed.tsx`) renders cards in `grid gap-4 sm:grid-cols-2` with infinite scroll. Cards (`ArticleCard`) have a 16/9 thumbnail, title, three-line summary clamp, and a footer row with source · date on the left and a "read more" affordance on the right. The project uses Tailwind CSS v4 utility classes; styling is class-only, no CSS files to touch.

Pain points today:

- Only one grid breakpoint (`sm:grid-cols-2`); on `lg+` two wide cards look sparse, and `max-w-4xl` blocks adding a third column comfortably.
- Header headline jumps `text-4xl` → `sm:text-5xl` with nothing between or above.
- Card footer uses `justify-between` with a `min-w-0 truncate` left side, but on very narrow widths (~320px) long source names plus date can squeeze the "read more" label; the dot separator stays even when source is missing.

## Goals / Non-Goals

**Goals:**
- Card grid: 1 column (default) → 2 (`sm`) → 3 (`lg`), with the container widened to fit 3 readable columns.
- No horizontal overflow or clipped/colliding footer content at 320px width.
- Header scales smoothly across mobile/tablet/desktop.
- Empty state, error state, and end-of-feed/loading sentinel remain visually correct at all widths.

**Non-Goals:**
- No changes to data fetching, pagination size, infinite-scroll logic, server action, cron sync, or DB.
- No new i18n messages.
- No redesign of card visual identity (colors, fonts, hover states stay).

## Decisions

1. **Widen container to `max-w-6xl` on the news page only.** Three columns inside `max-w-4xl` (~896px) gives ~280px cards minus gaps — too cramped for 16/9 thumbnails + meta row. `max-w-6xl` (~1152px) yields ~360px columns at `lg`, matching the current 2-col card width feel. Alternative considered: keep `max-w-4xl` and stay 2-col — rejected, leaves the desktop sparseness unaddressed.

2. **Grid classes become `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` (with `gap-5` or similar at `lg` optional, default keep `gap-4`).** Pure utility change in `NewsFeed`; no layout JS.

3. **Header scale: `text-3xl sm:text-4xl lg:text-5xl`.** Adds a smaller mobile starting size and a mid step, removing the single abrupt jump. Lede stays `max-w-md`.

4. **Card footer hardening:** keep single-row `justify-between`, but add `gap-2` between the two sides, keep `min-w-0`/`truncate` on the source, render the `·` separator only when a source exists, and mark the date `shrink-0 whitespace-nowrap`. Alternative considered: stack footer into two rows below `sm` — rejected as unnecessary; truncation with proper flex constraints handles 320px.

5. **Verification by viewport sweep, not unit tests.** Layout-only change; verify at 320 / 375 / 768 / 1024 / 1440px in the running app (or browser devtools). No automated test additions — there is no visual-regression harness in the repo.

## Risks / Trade-offs

- [Wider container changes header/empty-state line lengths] → header text block keeps `max-w-md` on the lede; empty state keeps `max-w-sm`, so prose width is unaffected.
- [3 columns make titles wrap to more lines, uneven card heights] → cards already use `flex h-full flex-col` + `mt-auto` footer, so heights equalize per row; `line-clamp-3` bounds summaries.
- [Tailwind v4 / Next.js version drift from training data] → per AGENTS.md, consult `node_modules/next/dist/docs/` before code changes if any Next-specific API is touched (none expected — class-only edits).

## Migration Plan

Single PR, presentation-only. Rollback = revert commit.

## Open Questions

None.
