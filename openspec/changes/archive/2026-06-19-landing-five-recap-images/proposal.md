## Why

The landing page already shows a gallery of recently generated match recap images, but it's capped at 8. The ask is to feature exactly the **latest 5** generated images — a tighter, more curated strip that keeps the landing focused on the freshest content.

## What Changes

- Cap the landing recap gallery at the **5 most recent** completed renders (down from 8), newest first.
- Adjust the gallery layout so 5 items read cleanly across breakpoints (a single row of 5 on large screens, gracefully wrapping on smaller ones).
- No change to sourcing (active, completed renders via existing RLS), linking, alt text, or the hidden-when-empty behavior.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `landing-recent-recap-images`: the gallery's bounded count becomes exactly 5 (was an unspecified "bounded count", implemented as 8).

## Impact

- **Component**: `components/recent-recap-images.tsx` — `MAX_ITEMS` 8 → 5 and a grid tweak for a clean 5-up layout on large screens.
- No DB, API, dependency, or i18n changes; ordering, RLS sourcing, links, and empty-state behavior are unchanged.
