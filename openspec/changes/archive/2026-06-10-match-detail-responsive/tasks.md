# Tasks: match-detail-responsive

## 1. Scoreboard stack

- [x] 1.1 In `app/[locale]/(public)/matches/[matchId]/page.tsx`, change the scoreboard container from `grid grid-cols-[1fr_auto_1fr] items-center gap-3 ... sm:gap-6` to stack below `sm` (`flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6`), keeping `sm`+ markup identical
- [x] 1.2 Center the score/"vs" block on mobile (self/justify centering that works as a flex child) and confirm the away block keeps its right alignment on mobile
- [x] 1.3 Verify the final-score variant statically: center block content swaps but layout classes are shared, so the stack must apply to it identically

## 2. Page-wide audit

- [x] 2.1 Run the dev server and audit `/matches/<id>` at 320, 375, 414, and 768px in en/es/fr: `scrollWidth <= innerWidth`, team-name spans not clipped (`scrollWidth <= clientWidth`), status chips, kickoff/venue strip, and countdown legible
- [x] 2.2 Statically review the signed-in branches (prediction form, locked card, group standings section) for fixed widths or non-wrapping flex rows at 320px; fix only confirmed issues

## 3. Validation

- [x] 3.1 Re-run the audit from 2.1 and confirm every spec scenario passes (stacked < 640px, three columns ≥ 640px, names readable at 320px, no overflow)
- [x] 3.2 Compare ≥ 640px screenshots against `main` to confirm desktop is visually unchanged
- [x] 3.3 Run `npm run lint`, `npm run typecheck`, and `npm test`; confirm no regressions
