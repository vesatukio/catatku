const CACHE_NAME = "catatku-v3";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];

// INSTALL
self.addEventListener("install", event => {
  console.log("CatatKu SW: install", CACHE_NAME);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE
self.addEventListener("activate", event => {
  console.log("CatatKu SW: activate", CACHE_NAME);

  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// FETCH
self.addEventListener("fetch", event => {

  const request = event.request;

  // Hanya GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Jangan cache Google Apps Script
  if (
    url.hostname.includes("script.google.com") ||
    url.hostname.includes("googleusercontent.com")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Untuk HTML: NETWORK FIRST
  // agar tampilan terbaru langsung digunakan
  if (
    request.mode === "navigate" ||
    request.destination === "document"
  ) {
    event.respondWith(
      fetch(request)
        .then(response => {

          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy));

          return response;
        })
        .catch(() => caches.match(request))
    );

    return;
  }

  // JS / CSS / manifest:
  // NETWORK FIRST
  event.respondWith(
    fetch(request)
      .then(response => {

        const copy = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => cache.put(request, copy));

        return response;
      })
      .catch(() => caches.match(request))
  );
});
