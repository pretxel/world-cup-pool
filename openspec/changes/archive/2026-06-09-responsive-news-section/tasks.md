# Tasks — Responsive News Section

## 1. Page layout (`app/[locale]/(public)/news/page.tsx`)

- [x] 1.1 Widen the page container from `max-w-4xl` to `max-w-6xl` on both the main render and the error-state render
- [x] 1.2 Change the headline scale to `text-3xl sm:text-4xl lg:text-5xl` (keep `font-heading`, tracking, and condensed font-stretch)

## 2. Feed grid and card (`app/[locale]/(public)/news/news-feed.tsx`)

- [x] 2.1 Update the card grid to `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`
- [x] 2.2 Harden the `ArticleCard` footer: add `gap-2` between the left meta group and the "read more" group, keep `min-w-0 truncate` on the source name, and make the date `shrink-0 whitespace-nowrap`
- [x] 2.3 Render the `·` separator only when `article.source` exists

## 3. Verification

- [x] 3.1 Run the app and sweep the news page at 320, 375, 768, 1024, and 1440px: confirm 1/2/3 column counts per breakpoint, no horizontal overflow, footer never collides, 16/9 thumbnails intact
- [x] 3.2 Check empty state and end-of-feed/loading sentinel still render centered and intact at mobile and desktop widths
- [x] 3.3 Run `npm run lint` (or project lint script) to confirm no class/JSX issues
