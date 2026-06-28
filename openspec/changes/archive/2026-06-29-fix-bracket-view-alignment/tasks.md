## 1. Fix desktop column structure

- [x] 1.1 In `components/bracket-view.tsx`, remove `justify-around` from the round column wrapper and keep the `<h2>` heading as the top item.
- [x] 1.2 Wrap `round.matches.map(...)` in a `flex flex-1 flex-col justify-around gap-3` sub-container so only the match cards are distributed in the space beneath the heading.
- [x] 1.3 Update the component's layout comment to reflect that headings are pinned at the top and only the matches are distributed.

## 2. Verify

- [x] 2.1 Visually verify on a desktop viewport: round headings align on one top baseline across columns; a sparse later-round column (e.g. one R16/QF match) keeps its heading at the top with the card centered between its feeders.
- [x] 2.2 Confirm the mobile round selector and the third-place block are unchanged.
- [x] 2.3 Run `pnpm lint`, `pnpm typecheck`, and `pnpm test bracket`.
