# Tasks: match-section-responsive

## 1. Baseline audit

- [x] 1.1 Run the dev server and audit `/matches` at 320, 375, 414, 768, 1024, and 1280px widths; record every overflow, clipping, or crowding issue (check `document.documentElement.scrollWidth <= window.innerWidth` at each width)
- [x] 1.2 Measure the site nav height at mobile and desktop widths and confirm whether the sticky day-header offset `top-[3.55rem]` is correct on both; note the required responsive offsets if not
- [x] 1.3 Repeat the 320px check in `es` and `fr` locales for the status stat cards, row labels, and empty state (longest-string locale)

## 2. Match row card responsive layout

- [x] 2.1 In `app/[locale]/(public)/matches/page.tsx`, restructure the `MatchRowCard` team block to stack home/away on separate lines below `sm` (`flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2`) and hide the "vs" separator below `sm` (`hidden sm:inline`)
- [x] 2.2 Compress the kickoff column on mobile: hide the eyebrow label and vertical divider below `sm`, let the column shrink (`w-auto sm:w-14`), keep the time visible at all widths
- [x] 2.3 Apply `min-w-0` / `truncate` / `break-words` discipline to all flexible row children (team lines, venue line) so no string can force horizontal overflow
- [x] 2.4 Verify the score/status column and chevron stay right-aligned and unclipped at 320px next to the stacked team lines

## 3. Filters and sticky headers

- [x] 3.1 Fix any stat-card clipping found in 1.3 (e.g. `truncate` on the label, tighter mobile padding); skip if the audit passed
- [x] 3.2 Verify team chips wrap at 320px with no horizontal overflow; fix only if the audit failed
- [x] 3.3 Apply responsive sticky-header offsets from 1.2 if the nav height differs across breakpoints; otherwise leave `top-[3.55rem]`

## 4. Validation

- [x] 4.1 Re-run the full breakpoint audit from 1.1 (all six widths, en + es + fr) and confirm every spec scenario passes: no horizontal overflow, stacked teams < 640px, unchanged single-line layout ≥ 640px, legible long team names, usable filters, correct sticky offsets
- [x] 4.2 Confirm desktop (≥ 640px) rendering is visually unchanged from `main` (compare screenshots)
- [x] 4.3 Run `npm run lint` and the existing test suite; confirm no regressions
