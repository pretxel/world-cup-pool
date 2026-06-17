import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

// Renders a recap's `image_prompt` into an image via Leonardo.ai (gpt-image-2)
// and stores it in the public `match-recap-images` Supabase Storage bucket.
//
// Generation is ASYNC: requestMatchImageRender POSTs the prompt and records the
// returned generation id as `pending`; the result arrives later via the
// /api/callback-image webhook (or the poll fallback), both of which converge on
// finalizeRender to download the image, store it, and mark the row `complete`.
//
// NOTE: Leonardo's exact v2 response field names are not fully pinned in the
// public docs, so the id/status/url extractors below are deliberately tolerant
// of several shapes. Verify them against a live response (the documented webhook
// shape is `data.object.id` + `data.object.images[].url`).

type AdminClient = SupabaseClient<Database>;

const LEONARDO_GENERATIONS_URL = "https://cloud.leonardo.ai/api/rest/v2/generations";
// Poll fallback hits the v1 get-by-id endpoint.
const LEONARDO_GENERATION_BY_ID_URL = "https://cloud.leonardo.ai/api/rest/v1/generations";
const BUCKET = "match-recap-images";
// The template's 2:3 portrait. Both multiples of 16 and within Leonardo's pixel
// limits (832 * 1248 = 1,038,336 px; ratio 1.5:1).
const IMAGE_WIDTH = 832;
const IMAGE_HEIGHT = 1248;

export type RequestRenderResult = {
  requested: boolean;
  reason?: "no-key" | "no-prompt" | "missing";
};
export type FinalizeRenderResult = {
  finalized: boolean;
  reason?: "unknown" | "already-complete";
  storagePath?: string;
};
export type PollRenderResult = {
  polled: boolean;
  reason?: "no-key" | "missing" | "already-complete" | "pending";
};

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Find a key that looks like a generation id (camelCase or snake_case) anywhere
 * in the response tree. Leonardo's v2 response shape is not reliably documented,
 * so after the known paths we deep-scan for a `generation*id`-style key.
 */
function findGenerationIdDeep(node: unknown, seen = new Set<unknown>()): string | null {
  if (!node || typeof node !== "object" || seen.has(node)) return null;
  seen.add(node);
  const entries = Object.entries(node as Record<string, unknown>);
  for (const [key, value] of entries) {
    const k = key.toLowerCase().replace(/_/g, "");
    if (k.includes("generation") && k.includes("id")) {
      const v = asString(value);
      if (v) return v;
    }
  }
  for (const [, value] of entries) {
    const found = findGenerationIdDeep(value, seen);
    if (found) return found;
  }
  return null;
}

/**
 * Detect a Leonardo error body returned with HTTP 200. Leonardo's REST layer
 * proxies a GraphQL backend, so validation failures arrive as a GraphQL-style
 * envelope (`[{ message, extensions: { details: { message } } }]`) — or, for
 * some endpoints, `{ error }` / `{ errors: [...] }`. Returns the human message.
 */
function extractLeonardoError(json: unknown): string | null {
  if (Array.isArray(json)) {
    const first = asRecord(json[0]);
    const details = asRecord(asRecord(first.extensions).details);
    return asString(details.message) ?? asString(first.message);
  }
  const j = asRecord(json);
  if (typeof j.error === "string" && j.error.length > 0) return j.error;
  if (Array.isArray(j.errors)) {
    return asString(asRecord(j.errors[0]).message) ?? "validation error";
  }
  return null;
}

/** Pull the generation id out of a (tolerant) Leonardo create-generation reply. */
function extractGenerationId(json: unknown): string | null {
  const j = asRecord(json);
  const data = asRecord(j.data);
  const known =
    asString(asRecord(j.sdGenerationJob).generationId) ??
    asString(j.generationId) ??
    asString(j.generation_id) ??
    asString(j.id) ??
    asString(asRecord(j.generation).id) ??
    asString(asRecord(j.generation).generationId) ??
    asString(data.id) ??
    asString(asRecord(data.object).id);
  // Fall back to a deep scan for any generation-id-shaped key (no generic `id`
  // grab, so we never mistake a user/image id for the generation id).
  return known ?? findGenerationIdDeep(j);
}

/** Read completion status + first image URL from a (tolerant) generation object. */
function extractGenerationStatus(json: unknown): { complete: boolean; imageUrl: string | null } {
  const j = asRecord(json);
  const g = asRecord(j.generations_by_pk ?? j.generation ?? asRecord(j.data).object ?? j);
  const complete = String(g.status ?? "").toUpperCase() === "COMPLETE";
  const imagesRaw = g.generated_images ?? g.images;
  const images = Array.isArray(imagesRaw) ? imagesRaw : [];
  return { complete, imageUrl: asString(asRecord(images[0]).url) };
}

function extFromContentType(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

/**
 * Request a Leonardo render for one recap version's `image_prompt`. Records a
 * `pending` row keyed by the returned generation id. Dormant (`no-key`) when
 * `LEONARDO_API_KEY` is unset; `no-prompt` when the version has no image prompt
 * yet. On a configured-key Leonardo failure it records the row as `failed` and
 * rethrows, so the caller decides (admin action surfaces it; the auto chain logs
 * and swallows it).
 */
export async function requestMatchImageRender(
  admin: AdminClient,
  summaryId: string,
): Promise<RequestRenderResult> {
  if (!env.leonardoApiKey) return { requested: false, reason: "no-key" };

  const { data: row } = await admin
    .from("match_summaries")
    .select("image_prompt, match_id")
    .eq("id", summaryId)
    .maybeSingle();
  if (!row) return { requested: false, reason: "missing" };

  const prompt = (row.image_prompt ?? "").trim();
  if (!prompt) return { requested: false, reason: "no-prompt" };

  let generationId: string | null = null;
  try {
    const res = await fetch(LEONARDO_GENERATIONS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.leonardoApiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      // v2 nests generation settings under `parameters`; only `model` (and the
      // optional `public`) live at the top level. Sending these flat triggers
      // "Unexpected variable quality" (400).
      body: JSON.stringify({
        public: false,
        model: env.leonardoModel,
        parameters: {
          prompt,
          quality: "MEDIUM",
          quantity: 1,
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
          prompt_enhance: "OFF"
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Leonardo ${res.status}: ${detail.slice(0, 300)}`);
    }
    const json = await res.json();
    // Leonardo can return HTTP 200 with a GraphQL-style validation error body;
    // surface its message rather than mislabeling it as a missing id.
    const apiError = extractLeonardoError(json);
    if (apiError) {
      throw new Error(`Leonardo validation error: ${apiError}`);
    }
    generationId = extractGenerationId(json);
    if (!generationId) {
      // Surface the actual shape so the failed render row records it (visible in
      // the admin UI) — the v2 response field isn't reliably documented.
      throw new Error(
        `Leonardo response missing a generation id; response: ${JSON.stringify(json).slice(0, 400)}`,
      );
    }
  } catch (err) {
    // Record the failure (re-render replaces the row) so the admin can see/retry.
    await admin.from("match_summary_images").upsert(
      {
        summary_id: summaryId,
        match_id: row.match_id,
        provider: "leonardo",
        model: env.leonardoModel,
        generation_id: null,
        status: "failed",
        storage_path: null,
        error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
      },
      { onConflict: "summary_id" },
    );
    throw err instanceof Error ? err : new Error(String(err));
  }

  const { error } = await admin.from("match_summary_images").upsert(
    {
      summary_id: summaryId,
      match_id: row.match_id,
      provider: "leonardo",
      model: env.leonardoModel,
      generation_id: generationId,
      status: "pending",
      storage_path: null,
      error: null,
    },
    { onConflict: "summary_id" },
  );
  if (error) throw new Error(`Failed to record render for ${summaryId}: ${error.message}`);

  return { requested: true };
}

/**
 * Download a completed render's image and store it. Shared by the webhook and
 * the poll fallback. Idempotent: a no-op when the row is already `complete`, and
 * `unknown` when no render row matches the generation id (so the webhook can ack
 * an unrelated callback). Throws on a genuine download / upload / DB failure.
 */
export async function finalizeRender(
  admin: AdminClient,
  generationId: string,
  imageUrl: string,
): Promise<FinalizeRenderResult> {
  const { data: row } = await admin
    .from("match_summary_images")
    .select("id, match_id, summary_id, status")
    .eq("generation_id", generationId)
    .maybeSingle();
  if (!row) return { finalized: false, reason: "unknown" };
  if (row.status === "complete") return { finalized: false, reason: "already-complete" };

  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to download render ${generationId}: HTTP ${res.status}`);
  }
  const contentType = res.headers.get("content-type") ?? "image/png";
  const bytes = new Uint8Array(await res.arrayBuffer());

  // Deterministic path so a re-render overwrites in place and the public URL is
  // stable.
  const path = `${row.match_id}/${row.summary_id}.${extFromContentType(contentType)}`;
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (upErr) throw new Error(`Failed to upload render ${generationId}: ${upErr.message}`);

  const { error: updErr } = await admin
    .from("match_summary_images")
    .update({ status: "complete", storage_path: path, error: null })
    .eq("id", row.id);
  if (updErr) {
    throw new Error(`Failed to mark render ${generationId} complete: ${updErr.message}`);
  }

  return { finalized: true, storagePath: path };
}

/**
 * Poll Leonardo for a pending render and finalize it if complete. Used in local
 * dev (where the webhook can't reach localhost) and as a manual recovery path.
 * Shares finalizeRender, so the outcome is identical to the webhook.
 */
export async function pollMatchImageRender(
  admin: AdminClient,
  summaryId: string,
): Promise<PollRenderResult> {
  if (!env.leonardoApiKey) return { polled: false, reason: "no-key" };

  const { data: row } = await admin
    .from("match_summary_images")
    .select("generation_id, status")
    .eq("summary_id", summaryId)
    .maybeSingle();
  if (!row || !row.generation_id) return { polled: false, reason: "missing" };
  if (row.status === "complete") return { polled: false, reason: "already-complete" };

  const res = await fetch(`${LEONARDO_GENERATION_BY_ID_URL}/${row.generation_id}`, {
    headers: { authorization: `Bearer ${env.leonardoApiKey}`, accept: "application/json" },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Leonardo ${res.status}: ${detail.slice(0, 300)}`);
  }
  const { complete, imageUrl } = extractGenerationStatus(await res.json());
  if (!complete || !imageUrl) return { polled: false, reason: "pending" };

  await finalizeRender(admin, row.generation_id, imageUrl);
  return { polled: true };
}
