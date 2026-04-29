const CACHE_NAME = "avaliacao-anatomia-v24";

const URLS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/static/css/style.css",
  "/static/js/app.js",
  "/static/js/database.js",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/icons/maskable-512.png"
];

/* =========================
   INSTALL
========================= */
self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
      .catch(error => console.error("Erro no install:", error))
  );
});

/* =========================
   ACTIVATE
========================= */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .catch(error => console.error("Erro no activate:", error))
  );
});

/* =========================
   FETCH
========================= */
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  /* ignora requests externos */
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          if (
            response &&
            response.status === 200 &&
            response.type === "basic"
          ) {
            const clone = response.clone();

            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clone);
            });
          }

          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

/* =========================
   MENSAGEM DE UPDATE
========================= */
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
