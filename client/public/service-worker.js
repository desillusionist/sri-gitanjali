/* Kīrtan Guide PWA: cache the app shell and the verified local song sources. */
const CACHE_NAME = "kirtan-guide-shell-v1";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/manus-storage/kirtan-guide-mark_9e3cc07f.png",
  "/manus-storage/songs_577f33d4.json",
  "/manus-storage/songs_flattened_8aa8d357.csv"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkResponse = fetch(event.request)
        .then((response) => {
          if (response.ok && new URL(event.request.url).origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cachedResponse || (event.request.mode === "navigate" ? caches.match("/") : Response.error()));

      return cachedResponse || networkResponse;
    }),
  );
});
