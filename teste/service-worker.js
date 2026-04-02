const CACHE_NAME = "ebd-fiel-v2";
const APP_SHELL = [
  "/teste/",
  "/teste/index.html",
  "/teste/manifest.json",
  "/teste/icons/icon-192.png",
  "/teste/icons/icon-512.png",
  "/teste/icons/icon-512-maskable.png"
];

// Instala a nova versão e já assume o controle
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

// Remove caches antigos e assume as páginas abertas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Estratégia:
// HTML/navegação = network first
// arquivos estáticos = stale-while-revalidate
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Só trata requisições do mesmo domínio
  if (url.origin !== self.location.origin) return;

  // Navegação / HTML
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put("/teste/index.html", copy);
          });
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("/teste/index.html");
          return cached || Response.error();
        })
    );
    return;
  }

  // lessons.json: sempre tenta rede primeiro para refletir updates
  if (url.pathname.endsWith("/lessons.json") || url.pathname.endsWith("lessons.json")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || Response.error();
        })
    );
    return;
  }

  // Restante dos arquivos: responde do cache e atualiza em segundo plano
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
