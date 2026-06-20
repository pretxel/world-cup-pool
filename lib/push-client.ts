// Browser-only Web Push helpers used by the account-menu push toggle. Kept out
// of the component so the subscribe/unsubscribe ceremony (feature detection,
// permission, service-worker registration, key encoding) is testable and the
// component stays declarative. No "use server" / no server imports here — this
// runs entirely in the browser.

import { env } from "@/lib/env";

// VAPID public keys are base64url; the Web Push API wants a Uint8Array.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Back the view with a concrete ArrayBuffer so the type is the strict
  // Uint8Array<ArrayBuffer> the Push API's applicationServerKey expects.
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// True when the browser can do Web Push at all. On iOS this additionally
// requires the site be installed to the Home Screen (PWA); that surfaces as the
// service-worker / PushManager APIs being absent in a normal tab.
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// The shape the savePushSubscription server action accepts.
export interface SerializedPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

// Result of the subscribe attempt. "unsupported"/"denied" are expected,
// non-error outcomes the toggle handles by staying off.
export type SubscribeResult =
  | { status: "subscribed"; subscription: SerializedPushSubscription }
  | { status: "unsupported" }
  | { status: "denied" }
  | { status: "error"; message: string };

// Registers the service worker, requests permission, subscribes with the VAPID
// public key, and returns the serialized subscription for persistence. No-ops
// to "unsupported" when Web Push is unavailable or the VAPID public key is
// unset (feature dormant).
export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!isPushSupported() || !env.vapidPublicKey) {
    return { status: "unsupported" };
  }
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { status: "denied" };
    }
    // Reuse an existing subscription if present, else create one.
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey),
      }));
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { status: "error", message: "incomplete subscription" };
    }
    return {
      status: "subscribed",
      subscription: {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      },
    };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// Unsubscribes the browser endpoint (if any) and returns the endpoint string so
// the caller can remove the matching server row. Returns null when there was
// nothing to unsubscribe.
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return null;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return null;
    const { endpoint } = subscription;
    await subscription.unsubscribe();
    return endpoint;
  } catch {
    return null;
  }
}
