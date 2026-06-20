// World Cup Pools Web Push service worker.
//
// Minimal by design: it ONLY handles `push` and `notificationclick`. It does
// not intercept `fetch` and does not cache anything, so it never alters the
// app's network behavior or introduces accidental offline/caching semantics —
// it exists purely to receive push events while the tab is closed and to deep
// link on click. Served as a static asset from the origin root (scope "/").

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Non-JSON payloads are ignored rather than crashing the handler.
    payload = {};
  }

  const title = payload.title || "World Cup Pools";
  const options = {
    body: payload.body || "",
    data: { url: payload.url || "/" },
    tag: payload.tag,
    icon: "/icon.png",
    badge: "/icon.png",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Focus an existing tab already on the target URL if one exists.
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise focus any open window and navigate it, or open a new one.
      if (clientList.length > 0 && "navigate" in clientList[0]) {
        const client = clientList[0];
        await client.focus();
        return client.navigate(url);
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })(),
  );
});
