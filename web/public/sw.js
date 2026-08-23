// Service worker de Top 10 · Rugby Chile.
// Escrito a mano (archivo estático → compatible con Turbopack, a diferencia de
// next-pwa/Serwist que dependen de webpack). Hace:
//  - Caché offline: network-first para navegación y API (fallback a caché),
//    stale-while-revalidate para assets estáticos.
//  - Push: muestra notificaciones y maneja el click.
// Bump VERSION para invalidar todas las cachés viejas en el próximo deploy.
const VERSION = "v12";
const STATIC = `static-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const API = `api-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = ["/", OFFLINE_URL, "/manifest.json", "/icons/icon-192x192.png"];
const API_ORIGIN = "https://rugby-chile-api.onrender.com";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => ![STATIC, RUNTIME, API].includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Navegación (páginas) → network-first, fallback a caché, luego offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Rutas sensibles/auth (auth, admin, push): NO tocar — network-only. Cachear
  // datos por-usuario o auth'd está mal (stale / cruce de sesiones) y podía
  // romper la respuesta en la PWA. El browser las maneja normal.
  if (url.origin === API_ORIGIN && /\/(auth|admin|push)(\/|$)/.test(url.pathname)) {
    return;
  }

  // API pública (cross-origin) → network-first, cachea GET ok, fallback a caché
  // cuando no hay conexión (tablas/resultados vistos quedan disponibles).
  if (url.origin === API_ORIGIN) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(API).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // Assets estáticos same-origin (_next, iconos, imágenes) → stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

// ── Push ─────────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Top 10 · Rugby Chile";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-96x96.png",
    vibrate: [80, 40, 80],
    tag: data.tag,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(target) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
