# Responsive News Section

## Why

The News page (`/[locale]/news`) renders article cards in a fixed two-column grid above the `sm` breakpoint and a single column below it, with no further adaptation. On narrow phones the card meta row (source · date · "read more") crowds and can wrap awkwardly, the header type scale jumps abruptly, and on wide desktop viewports the two-column grid inside `max-w-4xl` leaves cards overly wide with wasted space. The section should adapt smoothly from small phones through large desktops.

## What Changes

- Make the news card grid fully responsive: 1 column on mobile, 2 columns from `sm`, 3 columns from `lg` (widening the page container as needed so 3 columns have room).
- Smooth the page header type scale across breakpoints (mobile → tablet → desktop) instead of a single `sm:` jump.
- Fix card footer/meta row behavior on narrow screens so source name truncates gracefully and the "read more" affordance never collides with the date.
- Keep thumbnail aspect ratio (`16/9`) and lazy loading unchanged; ensure images scale correctly at every column width.
- No data, API, or sync changes — presentation only.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `news`: The "Public news feed" requirement gains a responsive-layout requirement — the feed SHALL adapt its card grid and header across mobile, tablet, and desktop breakpoints without horizontal overflow or clipped content.

## Impact

- `app/[locale]/(public)/news/page.tsx` — header type scale, page container width.
- `app/[locale]/(public)/news/news-feed.tsx` — grid column classes, `ArticleCard` footer/meta layout.
- No changes to `actions.ts`, the sync cron route, the database, or i18n messages.
