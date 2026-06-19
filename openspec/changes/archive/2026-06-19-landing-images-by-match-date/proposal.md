## Why

The landing recap gallery currently picks and orders its 5 images by **render time** (when the comic was generated). That doesn't reflect the tournament timeline — a comic generated late for an early match can outrank a fresh match. Ordering by the **match date** makes the strip read as "the latest matches", which is what users expect.

## What Changes

- Select and order the landing gallery's 5 images by their **match kickoff date**, most recent match first (instead of by render `created_at`).
- The gallery shows the 5 completed recap images whose matches are the most recent; ties and sourcing (active completed renders via RLS), links, alt text, and hidden-when-empty behavior are unchanged.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `landing-recent-recap-images`: selection and ordering change from render time to match kickoff date (most recent match first); the cap stays at 5.

## Impact

- **Component**: `components/recent-recap-images.tsx` — fetch `kickoff_at` for each render's match, and select/sort the 5 by match kickoff date (desc) instead of `created_at`.
- No DB schema, API, dependency, or i18n changes; cap (5), RLS sourcing, links, alt text, and empty-state behavior unchanged.
