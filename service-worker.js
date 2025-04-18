self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('habit-tracker-cache').then(cache => {
      return cache.addAll([
        'index.html',
        'css/style.css',
        'js/main.js',
        'js/tracker.js',
        'js/remainder.js',
        'manifest.json',
        'icons/icon-192.png',
        'icons/icon-512.png'
      ]);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});