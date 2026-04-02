/* service-worker.js */

const CACHE_VERSION = "v1.0.0";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/**
 * Instalação:
 * - faz preload do shell principal
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

/**
 * Ativação:
 * - remove caches antigos
 * - assume controle imediato das páginas
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/**
 * Utilitário:
 * decide se a requisição é para arquivo estático
 */
function isStaticAsset(request) {
  return (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "worker" ||
    request.destination === "image" ||
    request.destination === "font"
  );
}

/**
 * Estratégia:
 * Network First para navegação HTML
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, networkResponse.clone());

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    return caches.match("/offline.html");
  }
}

/**
 * Estratégia:
 * Cache First para assets estáticos
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    if (request.destination === "image") {
      return new Response("", {
        status: 404,
        statusText: "Imagem não disponível offline",
      });
    }
    throw error;
  }
}

/**
 * Estratégia:
 * Stale While Revalidate para outras requisições GET
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  const networkFetch = fetch(request)
    .then((networkResponse) => {
      if (request.method === "GET" && networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  return cachedResponse || networkFetch || caches.match("/offline.html");
}

/**
 * Intercepta requisições
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Ignora extensões do navegador e requests não-http
  if (!url.protocol.startsWith("http")) return;

  // HTML / navegação
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Arquivos estáticos
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API / demais GET
  event.respondWith(staleWhileRevalidate(request));
});

/**
 * Permite atualizar o SW sob demanda pelo app
 */
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    );
  }
});

/**
 * Notificações push
 */
self.addEventListener("push", (event) => {
  let data = {
    title: "Nova notificação",
    body: "Você recebeu uma nova mensagem.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    url: "/",
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      data: {
        url: data.url,
      },
    })
  );
});

/**
 * Clique em notificação
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
