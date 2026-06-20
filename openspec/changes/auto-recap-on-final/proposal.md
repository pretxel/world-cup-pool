## Why

When a match finalizes, the AI recap **summary** is already generated automatically (the `sync-matches` cron calls `generatePendingSummaries`). But the next two steps — the **image prompt** and the **Leonardo image render** — only run when an admin clicks them in the admin match page (`generateMatchImagePrompt` + `requestMatchImageRender`, exposed as `generateAndRenderImageAction`). So a finalized match has a recap but no comic image until someone manually triggers it, which delays/blocks the landing gallery, the recap-digest email, and recap reactions (all keyed on a `complete` render).

Automate the full chain on finalize: **summary → image_prompt → Leonardo render**, with no admin action.

## What Changes

- Add two idempotent batch passes (mirroring `generatePendingSummaries`):
  - `generatePendingImagePrompts` — for each active summary that has content but no `image_prompt`, generate the prompt via `generateMatchImagePrompt` (gated on `OPENROUTER_API_KEY`).
  - `requestPendingRenders` — for each active summary that has an `image_prompt` but no `match_summary_images` render row, request a Leonardo render via `requestMatchImageRender` (gated on `LEONARDO_API_KEY`). The render completes asynchronously through the existing `/api/callback-image` webhook (or the admin poll fallback).
- Wire both into the `sync-matches` cron, right after the summary pass, as isolated steps (a failure is logged, never aborts the sync), so one cron run chains summary → prompt → render for matches that just went final. Both no-op when their API key is unset.
- Surface counts in the run summary / operations record (e.g. `imagePrompts`, `renders`).

## Capabilities

### New Capabilities
- `auto-recap-on-final`: when a match is final, the recap image pipeline (image prompt then Leonardo render) runs automatically off the existing sync cron — idempotently, isolated from the sync, and gated on the AI keys — so a completed comic appears without any admin action.

### Modified Capabilities
<!-- None at the spec level. match-ai-summary already auto-generates summaries; the admin one-click recap (recap-image-one-click) stays as a manual override/regenerate. This adds an automatic trigger for the prompt+render steps that were previously manual-only. -->

## Impact

- **New lib fns**: `generatePendingImagePrompts` (in `lib/matches/match-image-prompt.ts`) and `requestPendingRenders` (in `lib/matches/match-image-render.ts`), mirroring `generatePendingSummaries`.
- **Cron**: `app/api/cron/sync-matches/route.ts` runs the two new passes after `generatePendingSummaries`; counts added to the JSON summary.
- **Reuse**: existing `generateMatchImagePrompt`, `requestMatchImageRender`, and the `/api/callback-image` finalize path are unchanged.
- **No schema change** (`match_summaries.image_prompt` + `match_summary_images` already exist), no new dependency, no new cron route. Behavior is gated/no-op without `OPENROUTER_API_KEY` / `LEONARDO_API_KEY`.
- **Downstream**: landing recap gallery, recap-digest email, and recap-reactions light up automatically as renders complete.
