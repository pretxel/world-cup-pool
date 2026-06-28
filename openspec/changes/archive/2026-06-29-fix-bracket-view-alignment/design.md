## Context

`components/bracket-view.tsx` renders the desktop bracket as a horizontal flex row of round columns. Each column is:

```tsx
<div className="flex w-52 flex-col justify-around gap-3 sm:w-56">
  <h2>{round label}</h2>
  {round.matches.map((m) => <MatchCard ... />)}
</div>
```

The row stretches all columns to equal height (default `align-items: stretch`), and `justify-around` is meant to vertically center each later-round match between its two feeders. But because the `<h2>` heading is a sibling of the match cards inside the same `justify-around` container, the heading is distributed as just another flex item. In sparse later-round columns (1–2 matches) the free space pushes the heading toward the middle and the cards downward, so headings no longer align across columns and the bracket looks broken.

## Goals / Non-Goals

**Goals:**
- Round headings align on a single top baseline across all desktop columns.
- Match cards remain vertically distributed within each column so later-round matches still center between their feeders.
- Pure CSS/structure fix in one component; identical content and data.

**Non-Goals:**
- No drawn connector lines between rounds.
- No change to the mobile round selector, the match card, the third-place block, or any data/i18n.
- Not pursuing pixel-perfect feeder-to-child centering beyond what `justify-around` already provides.

## Decisions

### Separate the heading from the distributed match area

Restructure each column so the heading sits at the top and only the matches are distributed:

```tsx
<div className="flex w-52 flex-col gap-3 sm:w-56">
  <h2 ...>{round label}</h2>
  <div className="flex flex-1 flex-col justify-around gap-3">
    {round.matches.map((m) => <MatchCard ... />)}
  </div>
</div>
```

The column no longer uses `justify-around`; the heading is a fixed-height top item, and the `flex-1` sub-container fills the remaining (equal across columns) height and distributes the cards with `justify-around`. Because the row keeps all columns the same height and every heading has the same height, headings align at the top and the match-distribution areas line up — so feeder-centering is preserved (in fact corrected).

- **Alternative considered:** keep one container and pin the heading with `self-start` / order tricks — rejected; the heading would still consume a distribution slot.
- **Alternative considered:** absolutely position headings or draw SVG connectors — rejected as overkill for a layout bug and a larger surface change.

## Risks / Trade-offs

- **A single-match column centers its one card vertically** → That is the intended feeder-centering behavior and matches the other columns; acceptable and consistent.
- **Columns with many matches (R32) could in theory be shorter than later sparse columns** → The flex row equalizes column heights to the tallest (R32), so later columns get the extra space to distribute; the existing layout already relied on this and it is unchanged.
- **Regression risk to mobile** → None; the change is inside the `hidden lg:block` desktop branch only.
