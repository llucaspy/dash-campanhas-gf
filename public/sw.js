self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = {
      title: "Dashboard - Governo Federal",
      body: event.data ? event.data.text() : "Nova atualizacao disponivel.",
    };
  }

  const title = payload.title || "Dashboard - Governo Federal";
  const options = {
    body: payload.body || "Nova atualizacao disponivel.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: payload.tag || "dashboard-gf",
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: payload.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url.startsWith(self.location.origin)) {
          client.focus();
          if ("navigate" in client) return client.navigate(targetUrl);
          return;
        }
      }

      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
