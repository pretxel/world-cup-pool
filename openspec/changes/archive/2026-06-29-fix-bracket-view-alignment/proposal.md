## Why

On desktop the `/bracket` columnar layout misrenders (see screenshot): the round heading (`ROUND OF 32`, `ROUND OF 16`, `QUARTER-FINAL`, …) is a flex child of the column's `justify-around` flow, so in sparser later-round columns it drifts toward the vertical center instead of staying at the top. The result is that headings no longer line up across rounds and the match cards are shoved down — the bracket reads as broken (e.g. the Round of 16 heading floats mid-column with its single card pushed far below the Round of 32 cards).

## What Changes

- Pin the round heading to the **top** of each desktop bracket column so every round's heading sits on the same baseline, left-to-right.
- Apply `justify-around` only to the **match cards**, inside a `flex-1` sub-container beneath the heading, so each later-round match still centers between its two feeder matches while the headings stay fixed.
- No change to the match card, the mobile round selector, the third-place block, data, or i18n.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `playoff-bracket`: define the desktop columnar presentation so round headings align across columns and each round's matches are vertically distributed (later-round matches centered between their feeders) independently of the heading.

## Impact

- **Code (modified)**: `components/bracket-view.tsx` — desktop column structure only (split the heading out of the `justify-around` flow; wrap the matches in a `flex-1` distributed sub-container).
- **No impact** on `components/bracket-match-card.tsx`, `components/bracket-rounds-mobile.tsx`, `lib/bracket*`, data, schema, or translations.
