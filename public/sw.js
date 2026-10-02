const CACHE = 'ezra-giving-shell-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/icon-192.png','/icon-512.png','/apple-touch-icon.png'])));
  self.skipWaiting();
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); return response;
    }).catch(() => cached)));
  }
});
