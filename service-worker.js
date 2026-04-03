const CACHE_NAME = "ebd-fiel-v11";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./licao.html",
  "./offline.html",
  "./manifest.json",
  "./lessons.json",
  "./icones/icon-192.png",
  "./icones/icon-512.png"
];

// instala
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// ativa
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

// fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  // navegação HTML
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          return response;
        })
        .catch(async () => {
          const cachedPage =
            (await caches.match(req)) ||
            (await caches.match("./offline.html"));
          return cachedPage;
        })
    );
    return;
  }

  // lessons.json
  if (req.url.includes("lessons.json")) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(req)) ||
            (await caches.match("./lessons.json"))
          );
        })
    );
    return;
  }

  // imagens
  if (req.destination === "image") {
    event.respondWith(
      caches.match(req).then((cached) => {
        return (
          cached ||
          fetch(req)
            .then((response) => {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
              return response;
            })
            .catch(() => caches.match("./icones/icon-192.png"))
        );
      })
    );
    return;
  }

  // css / js / manifest / fontes / outros
  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return response;
        })
      );
    })
  );
});

