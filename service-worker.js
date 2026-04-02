const CACHE = "app-v1";

const FILES = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./licao.html"
];

// instala
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

// ativa
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// fetch
self.addEventListener("fetch", (e) => {
  const req = e.request;

  // páginas
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("./offline.html"))
    );
    return;
  }

  // imagens fallback
  if (req.destination === "image") {
    e.respondWith(
      caches.match(req).then(res => {
        return res || fetch(req).catch(() =>
          new Response(
            '<h1>Imagem offline</h1>',
            { headers: { "Content-Type": "text/html" } }
          )
        );
      })
    );
    return;
  }

  // padrão cache
  e.respondWith(
    caches.match(req).then(res => res || fetch(req))
  );
});
