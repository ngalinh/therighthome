// Minimal PWA service worker — installable + offline shell
const CACHE = "trh-v2";
const ASSETS = ["/manifest.webmanifest", "/icons/icon-192.svg", "/icons/icon-512.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // network-first for API

  // Navigation (HTML documents) are user-specific because they're server-
  // rendered with session data. Caching them showed stale greetings like
  // "Xin chào, admin" after switching to a named account. Always go network;
  // fall back gracefully when truly offline.
  if (request.mode === "navigate" || request.destination === "document") {
    e.respondWith(
      fetch(request).catch(() => new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })),
    );
    return;
  }

  // Static assets: cache-on-fetch, fall back to cached copy when offline.
  e.respondWith(
    fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(request)),
  );
});

self.addEventListener("push", (e) => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || "The Right Home", {
      body: data.body || "",
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((cls) => {
    for (const c of cls) if (c.url === url && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
