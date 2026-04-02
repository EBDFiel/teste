const CACHE_NAME = "ebd-fiel-v1.0.0";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./lessons.json",
  "./licao.html",
  "./offline.html",
  "./icones/icon-192.png",
  "./icones/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
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
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (!url.protocol.startsWith("http")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(async () => {
          const cachedPage =
            (await caches.match(request)) ||
            (await caches.match("./index.html")) ||
            (await caches.match("./offline.html"));
          return cachedPage;
        })
    );
    return;
  }

  if (url.pathname.endsWith("/lessons.json") || url.pathname.endsWith("lessons.json")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match("./lessons.json")) ||
            new Response(JSON.stringify({ adult: [], youth: [] }), {
              headers: { "Content-Type": "application/json" }
            })
          );
        })
    );
    return;
  }

  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "manifest"
  ) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) return cached;

        try {
          const response = await fetch(request);
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        } catch (error) {
          if (request.destination === "image") {
            const fallbackIcon =
              (await caches.match("./icones/icon-192.png")) ||
              (await caches.match("/teste/icones/icon-192.png"));
            if (fallbackIcon) return fallbackIcon;
          }
          throw error;
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;

      try {
        const response = await fetch(request);
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      } catch (error) {
        return (
          (await caches.match("./offline.html")) ||
          new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain" }
          })
        );
      }
    })
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    );
  }
});
