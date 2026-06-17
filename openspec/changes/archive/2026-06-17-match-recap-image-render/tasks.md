## 1. Prerequisite

- [x] 1.1 Confirm `match-recap-image-prompt` is implemented (the `match_summaries.image_prompt` column and its auto chain exist); this change builds on it

## 2. Schema, storage & config

- [x] 2.1 Migration `supabase/migrations/<ts>_match_summary_images.sql`: create `match_summary_images` (`id`, `summary_id` unique FK → `match_summaries` on delete cascade, `match_id`, `provider` default `leonardo`, `model`, `generation_id` unique, `status` check in (`pending`,`complete`,`failed`) default `pending`, `storage_path`, `error`, `created_at`, `updated_at` + `set_updated_at` trigger); enable RLS, public SELECT policy mirroring active-recap visibility
- [x] 2.2 Same migration (or a paired one): create public Storage bucket `match-recap-images` (`insert into storage.buckets ... public = true`) and a public SELECT policy on `storage.objects` for that bucket; no public insert/update
- [x] 2.3 Add the `[storage.buckets.match-recap-images]` entry to `supabase/config.toml` (public) for local dev
- [x] 2.4 Apply migrations locally and regenerate `lib/database.types.ts`; confirm `match_summary_images` types appear

## 3. Env & secrets

- [x] 3.1 Add `leonardoApiKey` (`LEONARDO_API_KEY`), `leonardoWebhookSecret` (`LEONARDO_WEBHOOK_SECRET`), `leonardoModel` (`LEONARDO_MODEL`, default `gpt-image-2`) to `lib/env.ts`, all nullable/defaulted
- [x] 3.2 Document the three vars in `.env.example`, including the manual Leonardo console step (bind callback URL `https://world-pool.edselserrano.com/api/callback-image` + callback key when creating the production API key)

## 4. Render core (`lib/matches/match-image-render.ts`)

- [x] 4.1 `requestMatchImageRender(admin, summaryId)`: gate on `LEONARDO_API_KEY`; load the recap row; skip when `image_prompt` is null (`no-prompt`); `POST https://cloud.leonardo.ai/api/rest/v2/generations` with `model: leonardoModel`, `prompt: image_prompt`, `quantity: 1`, `quality: "MEDIUM"`, `width: 832`, `height: 1248`; upsert a `match_summary_images` row with the returned `generation_id` + `status: pending`; return `{ requested, reason? }`. On a configured-key Leonardo error mark `failed` + throw (admin) / log (auto)
- [x] 4.2 `finalizeRender(admin, generationId, imageUrl)` (shared by webhook + poll): no-op if the row is already `complete` (idempotent); fetch the image bytes; upload to `match-recap-images` at `<matchId>/<summaryId>.<ext>` (ext from content-type) via the service-role client with upsert; update the row `status: complete` + `storage_path`
- [x] 4.3 `pollMatchImageRender(admin, summaryId)`: `GET /generations/{id}` for the row's `generation_id`; when complete, call `finalizeRender` with the returned image URL; used for dev + manual recovery

## 5. Webhook route (`app/api/callback-image/route.ts`)

- [x] 5.1 POST handler: reject with 401 unless `authorization: Bearer <LEONARDO_WEBHOOK_SECRET>` matches (constant-time); 401 when the secret is unset
- [x] 5.2 Parse the body; handle `image_generation.complete`; read `data.object.id` (generation id) + `data.object.images[].url`; look up the render row by generation id; unknown id → 200 ack with no change
- [x] 5.3 On a known pending render call `finalizeRender`; return 200; log and surface a non-2xx only on a genuine processing failure (Leonardo retries)

## 6. Triggers

- [x] 6.1 In the prompt change's auto chain (after `image_prompt` is set for the active recap), call `requestMatchImageRender(admin, summaryId)` inside try/catch that logs and swallows errors so recap/prompt/score/sync are never blocked
- [x] 6.2 Add admin server actions in `app/[locale]/(admin)/admin/matches/actions.ts`: `renderMatchImageAction(summaryId)` and `syncMatchImageRenderAction(summaryId)` (poll), guarded by the existing admin check, with `revalidatePath`
- [x] 6.3 On the admin match detail page, per recap version: show render `status`, the image when `complete` (public URL), and "Render image" + "Sync render" buttons with success/error feedback
- [x] 6.4 Add admin-UI strings for render/sync actions + statuses to the message catalogs (en/es/fr/de)

## 7. Tests & verification

- [x] 7.1 `requestMatchImageRender`: dormant when no key (no write), `no-prompt` skip, happy path POSTs `model: "gpt-image-2"` + correct dims and records `generation_id`/`pending`, Leonardo error marks `failed`
- [x] 7.2 Webhook route: missing/wrong bearer → 401, unset secret → 401, unknown generation id → 200 no-op, valid completion downloads+uploads+marks `complete`, duplicate callback is idempotent (mock Storage + fetch)
- [x] 7.3 `finalizeRender` / `pollMatchImageRender`: finalize uploads to the right path and updates status; poll finalizes a completed Leonardo job; both idempotent
- [x] 7.4 Auto-chain isolation: a render failure does not fail recap/image-prompt generation
- [x] 7.5 Run `pnpm lint` + test suite; manually verify end-to-end against a real Leonardo key in a deployed/preview env (auto render on a final match, admin render + sync, image served from the public bucket URL)
