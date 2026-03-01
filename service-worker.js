const CACHE_NAME = 'habit-tracker-pro-v3';
const ASSETS = [
  'index.html', 'css/style.css',
  'js/main.js', 'js/tracker.js', 'js/analytics.js', 'js/sounds.js', 'js/remainder.js',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(res => {
      return res || fetch(event.request).then(fetchRes => {
        if (event.request.url.includes('fonts.googleapis') || event.request.url.includes('cdn.jsdelivr')) {
          const clone = fetchRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return fetchRes;
      });
    }).catch(() => {
      if (event.request.destination === 'document') return caches.match('index.html');
    })
  );
});