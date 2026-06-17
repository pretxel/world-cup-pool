## Why

We already generate a factual, text-only recap (`match_summaries.content`) for every
final match via OpenRouter. That text is rich source material for a shareable visual,
but nothing turns it into something an image model can render. This change uses
OpenRouter to enrich each recap into a fully-formed image-generation prompt — a 90s
anime, 4-panel comic-strip rendering of the match story — and stores it on the same
row so an image can be created from it later.

## What Changes

- Add an `image_prompt` (nullable text) column to `match_summaries` to hold the
  enriched image-generation prompt derived from that row's `content`.
- Add a prompt builder that injects a row's recap `content` (plus match context:
  teams, score, stage) into a fixed 90s-anime comic-strip template. The fixed
  sections — **ART STYLE**, **CHARACTER DESIGN** (recurring protagonist "Kenji"),
  and **TECHNICAL SPECIFICATIONS** — stay verbatim; OpenRouter fills only the
  **PANEL LAYOUT & SCENE SEQUENCE** (4 panels, each with `Visual` + `Narration Box`)
  so the comic tells that match's story.
- Add a generator (`generateMatchImagePrompt`) that reads a summary row, calls
  OpenRouter, and writes the result to `image_prompt`. Dormant (no DB/network
  touch) when `OPENROUTER_API_KEY` is unset, mirroring the recap generator.
- Auto path: after the recap `content` is written for the active version in the
  result-sync flow, build and store its `image_prompt`, isolated so a failure never
  blocks recap or score writes.
- Admin path: add a per-recap-version "Generate image prompt" action on the admin
  match detail page so an admin can (re)build the prompt for any version on demand.
- OUT OF SCOPE: actually calling an image model to render a picture. This change
  only produces and stores the prompt ("for later create an image").

## Capabilities

### New Capabilities
- `match-recap-image-prompt`: Enriching a stored match recap into a 90s-anime
  comic-strip image-generation prompt via OpenRouter, persisting it on
  `match_summaries`, and exposing both automatic (post-recap) and admin-triggered
  generation. Covers the template contract, the new column, key-dormant behavior,
  and failure isolation.

### Modified Capabilities
<!-- No spec-level requirement changes to existing capabilities. The recap auto-flow
     (match-ai-summary) and admin recap actions (admin-match-summary) are extended
     in code, but their existing requirements are unchanged; the new behavior lives
     entirely in the new capability above. -->

## Impact

- **Database**: new migration adding `match_summaries.image_prompt text` (nullable);
  regenerate `lib/database.types.ts`.
- **Code (new)**: `lib/matches/match-image-prompt.ts` — fixed template constants,
  pure `buildImagePromptMessages()`, and `generateMatchImagePrompt(admin, summaryId)`.
- **Code (extended)**: `lib/matches/match-summary.ts` (chain image-prompt build into
  the auto path after `content` is stored); admin match actions
  (`app/[locale]/(admin)/admin/matches/actions.ts`) and the admin match detail page
  (`app/[locale]/(admin)/admin/matches/[matchId]/page.tsx`) for the on-demand action.
- **Dependencies**: none new — reuses `lib/ai/openrouter.ts` (chat completions) and
  `env.openrouterModel`. No image-model dependency added.
- **i18n**: one admin-UI label/toast string for the new action.
