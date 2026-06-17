## Context

This change layers on `match-recap-image-prompt`, which adds
`match_summaries.image_prompt` (a 90s-anime comic-strip image prompt derived from the
recap) and an auto chain that fills it for the active recap. Nothing yet turns that
prompt into an image. Here we render it via Leonardo.ai's GPT-Image-2 and store the
result in Supabase Storage.

Constraints established from the Leonardo docs and the repo:
- Generation is **asynchronous**: `POST https://cloud.leonardo.ai/api/rest/v2/generations`
  (Bearer key, `model: "gpt-image-2"`) returns a generation id; the image arrives later.
- The webhook is bound **to the production API key at creation time** in Leonardo's
  console (callback URL + callback API key) — not per request and not settable via API.
  Callbacks POST `image_generation.complete` with image URLs at `data.object.images[].url`
  and the generation id at `data.object.id`, authenticated by
  `authorization: Bearer <callbackApiKey>`, from six fixed Leonardo IPs.
- The repo has no existing Storage usage. It already verifies an inbound webhook by
  shared secret (`app/api/auth/send-email`), and reads optional providers via nullable
  `env` keys that keep features dormant when unset.

## Goals / Non-Goals

**Goals:**
- Render a recap's `image_prompt` to an image and store it publicly in Supabase Storage.
- Receive results over an authenticated `/api/callback-image` webhook, with a poll
  fallback for environments the webhook can't reach.
- Trigger automatically after the prompt is set (active recap, isolated) and on demand
  from the admin detail page.
- Stay dormant when `LEONARDO_API_KEY` / `LEONARDO_WEBHOOK_SECRET` are unset.

**Non-Goals:**
- Editing/cropping/variants of the image, or storing multiple historical renders per
  version (one current render per recap version; re-render overwrites).
- Localizing or templating the prompt (owned by `match-recap-image-prompt`).
- Automating Leonardo's console webhook binding (manual, documented step).
- A public gallery/UI surface for the images beyond the admin page (the public URL is
  available for later use, e.g. OG images or share cards).

## Decisions

### Separate `match_summary_images` table (vs columns on `match_summaries`)
Render plumbing (generation id, status, storage path, error) is a distinct lifecycle
from the recap text and would bloat the recap row. A 1:1 table keyed by
`summary_id` (unique FK, cascade) keeps it isolated; a unique `generation_id` column is
the webhook's correlation key. Re-render updates the existing row (no history table —
YAGNI). Alternative (columns on `match_summaries`) was rejected to keep that table
focused and avoid mixing async render state into recap reads.

### Async correlation by generation id
Leonardo's callback carries its own generation id, not our row id (v2 has no custom
metadata passthrough we rely on). So the request path stores the returned
`generation_id` on the render row; the webhook and poll both look the row up by it. This
is the only reliable join between our request and Leonardo's async result.

### One shared finalize step
The webhook and the poll fallback converge on `finalizeRender(admin, generationId,
imageUrl)`: download the image bytes, upload to the bucket at a deterministic path
(`<matchId>/<summaryId>.<ext>`), and mark the row `complete`. Deterministic paths make
re-renders overwrite in place and keep the public URL stable. Idempotency: finalize
is a no-op when the row is already `complete`.

### Public bucket `match-recap-images`
The comic is a shareable asset and the active recap is already public, so a public-read
bucket lets us serve the image by stable public URL with no signing. Writes are
service-role only (webhook/poll run server-side). Created via SQL migration
(`storage.buckets` insert + a public SELECT policy on `storage.objects`) and mirrored
in `supabase/config.toml` for local dev. Alternative (private + signed URLs) adds
signing on every read for no benefit here.

### Webhook at `/api/callback-image`, verified by shared secret
Implemented as a route handler under `/api/` (repo convention), mirroring the existing
send-email hook's shared-secret verification: reject unless
`authorization: Bearer <LEONARDO_WEBHOOK_SECRET>` matches (constant-time compare).
Unknown generation id → 200 ack (idempotent, avoids retry storms). The six Leonardo
source IPs MAY be allowlisted as defense-in-depth; the bearer secret is the primary
gate. Note: the production key's callback URL must therefore be
`https://world-pool.edselserrano.com/api/callback-image`.

### Triggers: auto (isolated) + admin
The prompt change's auto chain, after setting `image_prompt` on the active recap, calls
`requestMatchImageRender(admin, summaryId)` inside try/catch so a render failure never
touches recap/score/sync. The admin detail page adds a "Render image" action (and, for
dev/fallback, a "Sync render" poll action) per version via server actions guarded by the
existing admin check, with `revalidatePath`.

### Secrets dormant by default
`leonardoApiKey` / `leonardoWebhookSecret` / `leonardoModel` join `lib/env.ts` as
nullable (model defaults to `gpt-image-2`). No key → request path no-ops; no webhook
secret → webhook 401s everything. The API key lives only in env / platform secrets,
never committed.

## Risks / Trade-offs

- **Credit spend on every final match (auto render)** → Cost is accepted (chosen
  "both"). Bounded by finals/day and the recap batch cap; render only the ACTIVE recap,
  never drafts; key-gated so a cold env spends nothing.
- **Webhook never arrives / Leonardo console misconfigured** → Render rows stick at
  `pending`. Mitigation: the poll fallback (`GET /generations/{id}`) finalizes manually;
  admin sees `pending`/`failed` and can re-render. A future cron sweep over stale
  `pending` rows is possible but out of scope.
- **Webhook spoofing** → Bearer-secret verification (constant-time) + optional IP
  allowlist; storage writes are service-role only and never driven by request body
  fields other than the looked-up render row.
- **Image URL expiry before download** → Finalize downloads immediately on callback;
  store our own copy in Storage so we never depend on Leonardo's hosted URL.
- **Local dev can't receive webhooks** → Poll fallback action covers dev and acts as a
  manual recovery path in prod.
- **Leaked API key (shared in chat in plaintext)** → Documented rotate step when binding
  the production webhook key; key only ever in env/secrets.

## Migration Plan

1. Land `match-recap-image-prompt` first (provides `image_prompt`).
2. Migration: create `match_summary_images`; create the `match-recap-images` bucket and
   its public-read object policy; add the local `config.toml` bucket entry. Regenerate
   `lib/database.types.ts`.
3. Add `lib/matches/match-image-render.ts` (request, finalize, poll) + the
   `/api/callback-image` route; unit-test request shape, webhook auth, idempotency,
   finalize with mocked Storage + fetch.
4. Chain the auto render in the prompt flow; add admin render/sync actions + detail-page
   UI + i18n strings.
5. Operator step: create a Leonardo production API key bound to callback URL
   `https://world-pool.edselserrano.com/api/callback-image` + a callback key; set
   `LEONARDO_API_KEY` and `LEONARDO_WEBHOOK_SECRET`; rotate the previously-shared key.
6. Rollback: dormant without keys; the table/bucket are additive and unread elsewhere, so
   reverting the code is safe (drop table/bucket in a follow-up if desired).

## Open Questions

- Default `quality` (`MEDIUM` vs `HIGH`) and exact portrait dimensions — start
  `MEDIUM`, 832×1248 (2:3, ×16, ~1.04MP), tune after seeing real cost/quality.
- Should a scheduled sweep auto-finalize/expire stale `pending` renders? Deferred; the
  manual poll action covers it for now.
- Stored image format from GPT-Image-2 (png vs webp) — detect from response/content-type
  when choosing the object extension.
