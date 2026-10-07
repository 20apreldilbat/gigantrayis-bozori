// ============================================
// RAYIS BOZORI — Service Worker
// ============================================

const CACHE_VERSION = 'rayis-v1.0.0';
const CACHE_STATIC = 'rayis-static-v1';
const CACHE_DYNAMIC = 'rayis-dynamic-v1';

const STATIC_FILES = [
  './', './index.html', './home.html', './kalkulyator.html',
  './search.html', './product.html', './cart.html', './checkout.html',
  './payment.html', './orders.html', './favorites.html', './profile.html',
  './seller.html', './admin.html', './xizmat.html', './usta.html',
  './ijarachi.html', './delivery.html', './chat.html', './shop.html',
  './notifications.html', './manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(STATIC_FILES.map(url => new Request(url, { credentials: 'same-origin' })))
        .catch(err => console.warn('[SW] Cache xato:', err));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_STATIC && key !== CACHE_DYNAMIC)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;

  if (url.origin !== location.origin) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_DYNAMIC).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_DYNAMIC).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => new Response('Offline', { status: 503 }));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => { keys.forEach(key => caches.delete(key)); });
  }
});

console.log('[SW] RAYIS Service Worker yuklandi');