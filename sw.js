const CACHE_NAME = "avaliacao-anatomia-v21";

const URLS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/sw.js",

  "/static/css/style.css",
  "/static/js/app.js",
  "/static/js/database.js",

  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/icons/maskable-512.png"
];

self.addEventListener("install", event => {

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );

  self.skipWaiting();

});

self.addEventListener("activate", event => {

  event.waitUntil(
    caches.keys().then(keys => {

      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );

    })
  );

  self.clients.claim();

});

self.addEventListener("fetch", event => {

  event.respondWith(
    caches.match(event.request).then(response => {

      return response || fetch(event.request)
        .catch(() => caches.match("/"));

    })
  );

});
