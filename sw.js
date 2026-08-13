const CACHE_NAME = 'catatku-v1';
const ASSETS = [
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/api.js',
  './js/app.js',
  './js/dashboard.js',
  './js/transaksi.js',
  './js/kasir.js',
  './js/barang.js',
  './js/belanja.js',
  './js/hutang.js',
  './js/kategori.js',
  './js/notifikasi.js',
  './js/laporan.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).catch(() => {
        // Fallback or offline logic here if needed
      });
    })
  );
});
