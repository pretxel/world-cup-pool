## Why

The `match-recap-image-prompt` change produces a 90s-anime comic-strip image PROMPT
per recap, but stops at text ("for later create an image"). This change closes the
loop: it renders that prompt into an actual image via Leonardo.ai (GPT-Image-2),
stores the image in Supabase Storage, and surfaces it for the match — turning a recap
into a shareable visual.

## What Changes

- Add a render pipeline that sends a recap's `image_prompt` to Leonardo.ai
  (`POST /api/rest/v2/generations`, `model: "gpt-image-2"`) and tracks the async job.
- Add a Supabase Storage bucket `match-recap-images` (public read) holding the
  generated images; writes only via the service role.
- Add a webhook route `POST /api/callback-image` that receives Leonardo's
  `image_generation.complete` callback, authenticates it, downloads the image, and
  stores it. Correlation is by Leonardo's generation id.
- Add a local-dev/fallback poll path (`GET /generations/{id}`) that finalizes a render
  without a webhook, sharing the same download-and-store logic.
- Track render state per recap version in a new `match_summary_images` table
  (generation id, status, storage path, error).
- Trigger rendering two ways: automatically after a recap's `image_prompt` is set (the
  active version), isolated from the recap/sync flow; and on demand from the admin
  match detail page per version.
- Add nullable secrets `LEONARDO_API_KEY` and `LEONARDO_WEBHOOK_SECRET`; the feature
  stays dormant (no external calls) when unset.

## Capabilities

### New Capabilities
- `match-recap-image-render`: Rendering a recap's stored image prompt into an image via
  Leonardo.ai, receiving the result over an authenticated webhook (with a poll
  fallback), storing it in Supabase Storage, tracking the async render lifecycle, and
  triggering renders automatically and on demand. Covers the render request, webhook
  contract, storage, key-dormant behavior, and failure isolation.

### Modified Capabilities
<!-- No spec-level requirement changes to existing capabilities. This change depends on
     match-recap-image-prompt (the image_prompt column + its auto chain) but adds the
     render trigger as new behavior in the new capability; it does not alter the
     prompt capability's existing requirements. -->

## Impact

- **Depends on**: `match-recap-image-prompt` (the `image_prompt` column and its auto
  generation must exist first).
- **Database**: migration adding `match_summary_images` (1:1 with a recap version) and
  the `match-recap-images` Storage bucket + public-read object policy; regenerate
  `lib/database.types.ts`. Local `supabase/config.toml` bucket entry.
- **Code (new)**: `lib/matches/match-image-render.ts` (Leonardo client call, request +
  shared finalize/store, poll fallback); `app/api/callback-image/route.ts` (webhook).
- **Code (extended)**: the prompt change's auto chain (fire a render after
  `image_prompt` is set); admin match actions + match detail page (render + sync
  actions, render state + image display).
- **Config**: `lib/env.ts` gains `leonardoApiKey`, `leonardoWebhookSecret`,
  `leonardoModel`; `.env.example` documents them. Leonardo's webhook is bound to the
  production API key in their console — a manual setup step (URL
  `https://world-pool.edselserrano.com/api/callback-image`).
- **Dependencies**: none new (Leonardo + Supabase Storage reached over `fetch` /
  existing `@supabase/supabase-js`).
- **i18n**: admin-UI label/toast strings for render + sync actions (en/es/fr/de).
