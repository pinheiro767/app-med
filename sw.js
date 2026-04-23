const CACHE_NAME = "auditoria-mmii-v2";

const URLS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/sw.js",
  "/static/css/style.css",
  "/static/js/database.js",
  "/static/js/app.js",
  "/static/icons/icon192.png",
  "/static/icons/icon512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          return networkResponse;
        })
        .catch(() => {
          return caches.match("/");
        });
    })
  );
});
