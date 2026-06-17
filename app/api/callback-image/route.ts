import "server-only";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { finalizeRender } from "@/lib/matches/match-image-render";

// Leonardo.ai image-generation webhook. When a requested render completes,
// Leonardo POSTs `image_generation.complete` here with the generation id and the
// image URL(s). We authenticate with the callback API key (bound to the prod API
// key in Leonardo's console), then download + store the image via finalizeRender.
//
// The callback URL configured in Leonardo must be:
//   https://world-pool.edselserrano.com/api/callback-image

// Downloading + uploading the image can take a moment; give it headroom.
export const maxDuration = 30;

// Constant-time compare of `Authorization: Bearer <secret>` against the
// configured callback key. Length-guarded so timingSafeEqual never throws.
function bearerMatches(header: string | null, secret: string): boolean {
  const prefix = "Bearer ";
  if (!header || !header.startsWith(prefix)) return false;
  const token = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(secret);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(token, expected);
}

export async function POST(request: Request): Promise<NextResponse> {
  // No secret configured → reject everything (never process unauthenticated).
  if (!env.leonardoWebhookSecret) {
    console.error("[callback-image] LEONARDO_WEBHOOK_SECRET unset — rejecting");
    return new NextResponse("webhook secret not configured", { status: 401 });
  }
  if (!bearerMatches(request.headers.get("authorization"), env.leonardoWebhookSecret)) {
    return new NextResponse("invalid callback key", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }

  // Leonardo payload: { type, object, data: { object: { id, images: [{ url }] } } }.
  const root = (body ?? {}) as Record<string, unknown>;
  const dataObject = ((root.data as Record<string, unknown> | undefined)?.object ?? {}) as
    Record<string, unknown>;
  const generationId =
    typeof dataObject.id === "string" && dataObject.id.length > 0 ? dataObject.id : null;
  const images = Array.isArray(dataObject.images) ? dataObject.images : [];
  const firstUrl = (images[0] as Record<string, unknown> | undefined)?.url;
  const imageUrl = typeof firstUrl === "string" && firstUrl.length > 0 ? firstUrl : null;

  // Only act on completion events with a usable id; ack anything else so
  // Leonardo doesn't retry an event we intentionally ignore.
  if (root.type !== "image_generation.complete" || !generationId) {
    return NextResponse.json({ ignored: true });
  }
  if (!imageUrl) {
    console.error(`[callback-image] completion ${generationId} carried no image url`);
    return NextResponse.json({ ignored: true });
  }

  try {
    const admin = createAdminSupabaseClient();
    const result = await finalizeRender(admin, generationId, imageUrl);
    // unknown id / already-complete are both successful no-ops (idempotent).
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // A genuine download/upload/DB failure: surface 5xx so Leonardo retries.
    console.error("[callback-image] finalize failed:", err);
    return new NextResponse("finalize failed", { status: 500 });
  }
}
