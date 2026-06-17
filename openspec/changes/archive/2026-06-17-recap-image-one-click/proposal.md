## Why

Generating a recap's comic image is currently two admin clicks: **Generate image
prompt** (recap text → comic prompt) then **Render image** (prompt → Leonardo image).
For an admin who just wants "make the picture", that's avoidable friction. A single
one-click action that does both is faster and harder to get wrong (no rendering a
stale or missing prompt).

## What Changes

- Add a combined admin action `generateAndRenderImageAction(summaryId)` that, for one
  recap version, generates the `image_prompt` from the recap and then requests the
  Leonardo render — in one click, isolated so a partial failure is reported clearly.
- Add a per-version **"Generate & render image"** button on the admin match detail
  page, alongside the existing granular Generate-prompt / Render / Sync controls
  (which stay for fine-grained use).
- Surface a combined outcome (prompt + render) via the existing query-param/status
  pattern, including the partial case (prompt generated but render skipped/failed).
- Reuses the existing `generateMatchImagePrompt` and `requestMatchImageRender`; no new
  external calls, env vars, schema, or storage. Dormant exactly as today when
  `OPENROUTER_API_KEY` / `LEONARDO_API_KEY` are unset.

## Capabilities

### New Capabilities
- `recap-image-one-click`: A single admin affordance that chains image-prompt
  generation and Leonardo render for one recap version, with combined success /
  partial / failure reporting. Builds on `match-recap-image-prompt` and
  `match-recap-image-render` without changing their existing behavior.

### Modified Capabilities
<!-- None. The two underlying capabilities keep their existing requirements; this
     change adds a new combined entry point only. -->

## Impact

- **Depends on**: `match-recap-image-prompt` + `match-recap-image-render` (both shipped).
- **Code (extended)**: admin match actions (`app/[locale]/(admin)/admin/matches/actions.ts`)
  — new `generateAndRenderImageAction`; admin match detail page
  (`app/[locale]/(admin)/admin/matches/[matchId]/page.tsx`) — new button + outcome
  mapping.
- **i18n**: admin-UI label/pending + combined-outcome strings (en/es/fr/de).
- **No** new dependencies, env vars, migrations, or storage.
