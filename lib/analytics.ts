// Client-side custom GA event instrumentation.
//
// `trackEvent` emits a custom Google Analytics event via the global `gtag`
// defined by the loader in `app/layout.tsx`. It is a silent no-op when gtag is
// unavailable — during SSR, when no GA measurement id is configured, when GA is
// blocked, or before the loader has run — so emitting an event never blocks or
// breaks the interaction it measures. Events are fire-and-forget; there is no
// queue, so an event emitted before gtag loads is simply dropped.

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }
  window.gtag("event", name, params);
}
