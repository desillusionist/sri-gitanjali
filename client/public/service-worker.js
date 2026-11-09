/*
 * Kīrtan Guide PWA: the newest app shell when online, everything already seen
 * when offline.
 *
 * - Pages: network first, falling back to the cached shell (the app routes
 *   /song/… itself).
 * - Built assets (/assets/…, hashed): cache first; they never change.
 * - Song data and translations (/manus-storage/….json): network first, so
 *   corrections show up at once; the cached copy when offline.
 * - Fonts and images (/manus-storage/…): served from cache at once and
 *   refreshed in the background.
 * Precaching tolerates a missing file, so one absent asset never disables
 * offline use.
 */
const CACHE_NAME = "kirtan-guide-v7";
// "/" locally, "/sri-gitanjali/" on GitHub Pages.
const BASE = new URL(self.registration.scope).pathname;
const PRECACHE = [
  "",
  "manifest.webmanifest",
  "manus-storage/songs_577f33d4.json",
  "manus-storage/ru_user_updates_cd7dcc2b.json",
  "manus-storage/PalakaNew_e7867ee6.otf",
  "manus-storage/kirtan-guide-peacock-plume_09e0a26b.png",
  "manus-storage/kirtan-guide-icon-192.png",
  "manus-storage/kirtan-guide-icon-512.png",
  "manus-storage/nabadwip-temple02-hero_14e93d5b.webp",
  "manus-storage/author-bhaktivinod-thakur.webp",
  "manus-storage/author-sridhar-maharaj.webp",
  "manus-storage/author-govinda-maharaj.webp",
].map((path) => BASE + path);

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  // The built scripts and styles named in the page, so the first visit already works offline.
  let shellAssets = [];
  try {
    const html = await (await fetch(BASE, { cache: "reload" })).text();
    shellAssets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((match) => new URL(match[1], self.location.href).pathname);
  } catch {
    // Offline during install: assets are cached as they load.
  }
  await Promise.all([...PRECACHE, ...shellAssets].map(async (path) => {
    try {
      const response = await fetch(path, { cache: "reload" });
      if (response.ok) await cache.put(path, response);
    } catch {
      // Missing or unreachable: cached later, the first time it loads.
    }
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

async function putInCache(request, response) {
  if (!response.ok || response.type === "opaque") return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // In development, Vite modules must always arrive from the live server.
  if (!url.pathname.startsWith(BASE)) return;
  const path = url.pathname.slice(BASE.length - 1);
  if (path.startsWith("/src/") || path.startsWith("/@") || path.startsWith("/node_modules/") || path.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          event.waitUntil(putInCache(BASE, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(BASE)) || Response.error()),
    );
    return;
  }

  if (path.startsWith("/assets/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        event.waitUntil(putInCache(event.request, response.clone()));
        return response;
      })),
    );
    return;
  }

  if (path.startsWith("/manus-storage/") && path.endsWith(".json")) {
    event.respondWith(
      fetch(event.request, { cache: "no-cache" })
        .then((response) => {
          event.waitUntil(putInCache(event.request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          event.waitUntil(putInCache(event.request, response.clone()));
          return response;
        })
        .catch(() => cached || Response.error());
      if (cached) event.waitUntil(network.catch(() => undefined));
      return cached || network;
    }),
  );
});
