const RAZON_CACHE = "razon-pwa-v1";
const OFFLINE_URL = "/offline.html";
const STATIC_ASSETS = [
  "/",
  OFFLINE_URL,
  "/manifest.json",
  "/icons/razon-icon-192.svg",
  "/icons/razon-icon-512.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(RAZON_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== RAZON_CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(RAZON_CACHE).then(cache => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/") || caches.match(OFFLINE_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RAZON_CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL));
    })
  );
});
