## Context

`components/recent-recap-images.tsx` (server component, mounted in `app/[locale]/page.tsx`) queries `match_summary_images` for `status = 'complete'`, newest first, `limit(MAX_ITEMS)` where `MAX_ITEMS = 8`, resolves team names, and renders a responsive grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`). It returns `null` when there are no items. The `landing-recent-recap-images` spec only requires "a bounded count" — it does not pin the number — so changing it is a copy/clarify of that requirement, not a behavior break.

## Goals / Non-Goals

**Goals:**
- Show exactly the latest 5 completed renders.
- Keep the strip visually clean at 5 items across breakpoints.

**Non-Goals:**
- Changing the data source, ordering, RLS, links, alt text, or the hidden-when-empty behavior.
- Carousels, pagination, or a "see all" affordance.

## Decisions

### Decision: `MAX_ITEMS = 5`
One-line cap change; the existing `.limit(MAX_ITEMS)` query already does the right thing, so only the constant moves.

### Decision: 5-up on large screens
Update the grid to `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` so all five sit in one row on large screens, while smaller screens wrap (2/3 per row) — no awkward 4 + 1 orphan from the current `lg:grid-cols-4`.

*Alternative considered:* keep `lg:grid-cols-4` (leaves a lone 5th item on its own row) — rejected for the ragged look.

## Risks / Trade-offs

- **Fewer images on the landing** → intended; the ask is a tighter, fresher set.
- **5-up cards are narrower on large screens** → the `aspect-[2/3]` comic ratio still reads well at that width; acceptable.

## Migration Plan

Single-component constant + className change. No data/schema migration. Rollback = restore `MAX_ITEMS = 8` and the prior grid.

## Open Questions

- None.
