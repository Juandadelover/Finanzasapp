// Minimal service worker: exists to satisfy PWA installability criteria
// and give the app shell a little resilience on flaky connections.
// It intentionally does NOT cache anything from Supabase or the auth
// flow — that data is always fetched fresh.
// v2: las páginas de la app (con sesión) ya no se guardan en caché.
const CACHE_NAME = "finanzas-shell-v2";
const APP_SHELL = ["/login"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isBypassed(url) {
  return url.hostname.endsWith(".supabase.co") || url.pathname.startsWith("/auth/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isBypassed(url)) return;

  // Navegación: siempre a la red. Sin conexión se muestra el login guardado;
  // nunca una página de la app con datos de una sesión.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/login")));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
