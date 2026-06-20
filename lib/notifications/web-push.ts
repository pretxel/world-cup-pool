import "server-only";
import webpush from "web-push";
import { env } from "@/lib/env";

// The stored push_subscriptions row, narrowed to the fields web-push needs to
// address a single browser endpoint.
export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// The small JSON payload the service worker reads in its `push` handler. Kept
// flat and copy-only (no rich media / actions) — the service worker shows
// { title, body } and deep-links to { url } on click.
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

// Discriminated result so callers can react precisely:
// - "sent":    delivered, keep the subscription.
// - "expired": 410 Gone / 404 — the endpoint is dead, prune the row.
// - "skipped": VAPID env unset, nothing was sent (dormant feature).
// - "error":   transient/unexpected failure; the caller logs and moves on.
export type SendWebPushResult =
  | { status: "sent" }
  | { status: "expired"; statusCode: number }
  | { status: "skipped" }
  | { status: "error"; statusCode?: number; message: string };

// Configure web-push with the VAPID keys exactly once per server process. We
// memoize on a module-level flag rather than calling setVapidDetails on every
// send (the library stores them as global state). Returns false when any VAPID
// value is unset, so every caller no-ops cleanly — the same dormant-until-
// configured posture as the email dispatchers' RESEND_API_KEY gate.
let configured = false;
function ensureConfigured(): boolean {
  if (!env.vapidPublicKey || !env.vapidPrivateKey || !env.vapidSubject) {
    return false;
  }
  if (!configured) {
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    configured = true;
  }
  return true;
}

// Reports whether Web Push is fully configured. Callers use this to short-
// circuit a whole batch (skip the load + loop) before touching the database.
export function isWebPushConfigured(): boolean {
  return Boolean(env.vapidPublicKey && env.vapidPrivateKey && env.vapidSubject);
}

// Signs and sends one JSON payload to one subscription. No-ops (status
// "skipped") when VAPID env is unset. On a 410 Gone / 404 it returns
// "expired" so the caller can prune the dead row; any other failure is
// "error" (logged by the caller, run continues).
export async function sendWebPush(
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<SendWebPushResult> {
  if (!ensureConfigured()) {
    return { status: "skipped" };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return { status: "sent" };
  } catch (err) {
    // web-push throws a WebPushError carrying the push service's HTTP status.
    const statusCode = (err as { statusCode?: number } | null)?.statusCode;
    if (statusCode === 410 || statusCode === 404) {
      return { status: "expired", statusCode };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", statusCode, message };
  }
}
