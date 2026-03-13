const CACHE_NAME = "travel-note-v1";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/offline.html"
];

// install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // GET以外は触らない
  if (req.method !== "GET") return;

  // 開発中のVite/HMR系は素通し
  if (
    url.hostname === "localhost" ||
    url.port === "5173" ||
    url.pathname.includes("/@vite/") ||
    url.pathname.includes("/node_modules/") ||
    url.protocol === "ws:" ||
    url.protocol === "wss:"
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // 音声・動画・Range requestはキャッシュしない
  if (
    req.headers.has("range") ||
    req.destination === "audio" ||
    req.destination === "video" ||
    url.pathname.endsWith(".mp3") ||
    url.pathname.endsWith(".wav") ||
    url.pathname.endsWith(".ogg") ||
    url.pathname.endsWith(".m4a")
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // HTMLはネット優先、失敗時はoffline.html
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // それ以外は cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        // 206 Partial Content はキャッシュしない
        if (!res || res.status !== 200) return res;

        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return res;
      });
    })
  );
});