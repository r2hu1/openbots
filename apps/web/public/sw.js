// OpenBots Service Worker for Background Web Push Notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {
    title: "OpenBots Alert",
    body: "Your agent has an update.",
    url: "/",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "openbots-notification",
  };

  try {
    const data = event.data.json();
    payload = { ...payload, ...data };
  } catch {
    payload.body = event.data.text();
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    tag: payload.tag || "openbots-notification",
    data: {
      url: payload.url || "/",
    },
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this URL or app origin
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If no window is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
